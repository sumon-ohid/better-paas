package paas

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Minimal S3-compatible client (AWS SigV4)
// ---------------------------------------------------------------------------
//
// Supports any S3-compatible object store (AWS S3, Cloudflare R2, MinIO, etc.)
// using path-style addressing and AWS Signature Version 4. Implemented with the
// standard library only - no AWS SDK dependency - to keep the build lean.
//
// R2 note: use endpoint https://<accountid>.r2.cloudflarestorage.com and region
// "auto". S3 note: endpoint may be left blank to default to AWS regional host.

// s3Target describes where and how to store objects.
type s3Target struct {
	Endpoint        string // e.g. https://<account>.r2.cloudflarestorage.com (blank = AWS)
	Region          string // e.g. "auto" for R2, "us-east-1" for AWS
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	Prefix          string // optional key prefix, e.g. "baas/backups"
}

const s3Service = "s3"

// hostAndBaseURL resolves the endpoint host and a base URL for path-style
// bucket addressing. When Endpoint is empty, defaults to AWS regional host.
func (t s3Target) hostAndBaseURL() (host, base string) {
	ep := strings.TrimSpace(t.Endpoint)
	if ep == "" {
		region := t.Region
		if region == "" {
			region = "us-east-1"
		}
		host = fmt.Sprintf("s3.%s.amazonaws.com", region)
		return host, "https://" + host
	}
	// Normalize: strip scheme to get the host, keep https as the scheme.
	ep = strings.TrimSuffix(ep, "/")
	noScheme := ep
	if i := strings.Index(ep, "://"); i >= 0 {
		noScheme = ep[i+3:]
	}
	host = noScheme
	return host, "https://" + noScheme
}

// objectKey builds the full object key for a backup file name, applying Prefix.
func (t s3Target) objectKey(name string) string {
	p := strings.Trim(strings.TrimSpace(t.Prefix), "/")
	if p == "" {
		return name
	}
	return p + "/" + name
}

// s3PutObject uploads body to bucket/key using a signed PUT. The caller provides
// the total content length (S3 requires it for streaming uploads).
func s3PutObject(t s3Target, key string, body []byte) error {
	host, base := t.hostAndBaseURL()
	// Path-style URL: https://host/bucket/key
	rawURL := fmt.Sprintf("%s/%s/%s", base, t.Bucket, s3EscapePath(key))

	req, err := http.NewRequest(http.MethodPut, rawURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.ContentLength = int64(len(body))
	req.Header.Set("Content-Type", "application/gzip")

	region := t.Region
	if region == "" {
		region = "us-east-1"
	}
	if err := s3Sign(req, t.AccessKeyID, t.SecretAccessKey, region, host, body); err != nil {
		return err
	}

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("s3 PUT returned %d: %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	return nil
}

// s3PutFile streams a local file to object storage.
func s3PutFile(t s3Target, key, localPath string) error {
	data, err := os.ReadFile(localPath)
	if err != nil {
		return err
	}
	return s3PutObject(t, key, data)
}

// s3CheckAccess performs a lightweight authenticated request (list with
// max-keys=0) to verify credentials and bucket reachability.
func s3CheckAccess(t s3Target) error {
	host, base := t.hostAndBaseURL()
	rawURL := fmt.Sprintf("%s/%s/?list-type=2&max-keys=0", base, t.Bucket)

	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	region := t.Region
	if region == "" {
		region = "us-east-1"
	}
	if err := s3Sign(req, t.AccessKeyID, t.SecretAccessKey, region, host, nil); err != nil {
		return err
	}
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return nil
	}
	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	switch resp.StatusCode {
	case http.StatusForbidden:
		return fmt.Errorf("access denied - check the access key, secret, and bucket permissions")
	case http.StatusNotFound:
		return fmt.Errorf("bucket %q not found at this endpoint", t.Bucket)
	default:
		return fmt.Errorf("storage check failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}
}

// ---------------------------------------------------------------------------
// SigV4 signing
// ---------------------------------------------------------------------------

// s3Sign adds the Authorization and required headers for an AWS SigV4 request.
// payload is the exact request body (nil for empty).
func s3Sign(req *http.Request, accessKey, secretKey, region, host string, payload []byte) error {
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	payloadHash := sha256Hex(payload)

	req.Host = host
	req.Header.Set("Host", host)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	// Canonical headers - must be sorted by lowercased name.
	signedHeaderNames := []string{"host", "x-amz-content-sha256", "x-amz-date"}
	sort.Strings(signedHeaderNames)

	var canonicalHeaders strings.Builder
	for _, h := range signedHeaderNames {
		var v string
		switch h {
		case "host":
			v = host
		case "x-amz-content-sha256":
			v = payloadHash
		case "x-amz-date":
			v = amzDate
		}
		canonicalHeaders.WriteString(h)
		canonicalHeaders.WriteString(":")
		canonicalHeaders.WriteString(strings.TrimSpace(v))
		canonicalHeaders.WriteString("\n")
	}
	signedHeaders := strings.Join(signedHeaderNames, ";")

	canonicalQuery := canonicalizeQuery(req.URL.Query())

	canonicalRequest := strings.Join([]string{
		req.Method,
		req.URL.EscapedPath(),
		canonicalQuery,
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	scope := strings.Join([]string{dateStamp, region, s3Service, "aws4_request"}, "/")
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256HexString(canonicalRequest),
	}, "\n")

	signingKey := sigV4SigningKey(secretKey, dateStamp, region, s3Service)
	signature := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))

	auth := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		accessKey, scope, signedHeaders, signature,
	)
	req.Header.Set("Authorization", auth)
	return nil
}

// canonicalizeQuery returns the canonical query string per SigV4 rules.
func canonicalizeQuery(values url.Values) string {
	if len(values) == 0 {
		return ""
	}
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var parts []string
	for _, k := range keys {
		vs := values[k]
		sort.Strings(vs)
		for _, v := range vs {
			parts = append(parts, s3URIEncode(k, true)+"="+s3URIEncode(v, true))
		}
	}
	return strings.Join(parts, "&")
}

// s3EscapePath percent-encodes each path segment (preserving slashes).
func s3EscapePath(p string) string {
	segs := strings.Split(p, "/")
	for i, s := range segs {
		segs[i] = s3URIEncode(s, false)
	}
	return strings.Join(segs, "/")
}

// s3URIEncode implements AWS's URI encoding. When encodeSlash is false, "/" is
// left intact (used for path segments handled separately).
func s3URIEncode(s string, encodeSlash bool) string {
	var b strings.Builder
	for _, c := range []byte(s) {
		switch {
		case (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'),
			c == '-' || c == '_' || c == '.' || c == '~':
			b.WriteByte(c)
		case c == '/':
			if encodeSlash {
				b.WriteString("%2F")
			} else {
				b.WriteByte(c)
			}
		default:
			b.WriteString(fmt.Sprintf("%%%02X", c))
		}
	}
	return b.String()
}

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func sigV4SigningKey(secret, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), dateStamp)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	return hmacSHA256(kService, "aws4_request")
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func sha256HexString(s string) string {
	return sha256Hex([]byte(s))
}

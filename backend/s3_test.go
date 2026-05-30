package main

import (
	"net/http"
	"strings"
	"testing"
)

// TestSigV4SigningKey verifies the derived signing key against the published
// AWS SigV4 test vector (from the AWS docs "Examples of the complete Version 4
// signing process"). This pins the HMAC chain so signing bugs surface here.
func TestSigV4SigningKey(t *testing.T) {
	secret := "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"
	dateStamp := "20150830"
	region := "us-east-1"
	service := "iam"

	key := sigV4SigningKey(secret, dateStamp, region, service)
	got := hexLower(key)
	want := "c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9"
	if got != want {
		t.Fatalf("signing key mismatch:\n got=%s\nwant=%s", got, want)
	}
}

// TestS3URIEncode checks AWS-style URI encoding rules.
func TestS3URIEncode(t *testing.T) {
	cases := []struct {
		in          string
		encodeSlash bool
		want        string
	}{
		{"abc", true, "abc"},
		{"a b", true, "a%20b"},
		{"a/b", false, "a/b"},
		{"a/b", true, "a%2Fb"},
		{"file-1.0_test~", true, "file-1.0_test~"},
		{"k+v", true, "k%2Bv"},
	}
	for _, c := range cases {
		if got := s3URIEncode(c.in, c.encodeSlash); got != c.want {
			t.Errorf("s3URIEncode(%q,%v)=%q want %q", c.in, c.encodeSlash, got, c.want)
		}
	}
}

// TestObjectKey verifies prefix handling.
func TestObjectKey(t *testing.T) {
	cases := []struct {
		prefix, name, want string
	}{
		{"", "backup.tar.gz", "backup.tar.gz"},
		{"baas/backups", "b.tar.gz", "baas/backups/b.tar.gz"},
		{"/baas/backups/", "b.tar.gz", "baas/backups/b.tar.gz"},
	}
	for _, c := range cases {
		tg := s3Target{Prefix: c.prefix}
		if got := tg.objectKey(c.name); got != c.want {
			t.Errorf("objectKey(prefix=%q,name=%q)=%q want %q", c.prefix, c.name, got, c.want)
		}
	}
}

// TestHostAndBaseURL covers AWS default and custom (R2) endpoints.
func TestHostAndBaseURL(t *testing.T) {
	// AWS default when endpoint blank.
	aws := s3Target{Region: "eu-west-1"}
	host, base := aws.hostAndBaseURL()
	if host != "s3.eu-west-1.amazonaws.com" || base != "https://s3.eu-west-1.amazonaws.com" {
		t.Errorf("aws default: host=%q base=%q", host, base)
	}

	// R2-style endpoint with scheme should be normalized.
	r2 := s3Target{Endpoint: "https://acc.r2.cloudflarestorage.com/", Region: "auto"}
	host, base = r2.hostAndBaseURL()
	if host != "acc.r2.cloudflarestorage.com" || base != "https://acc.r2.cloudflarestorage.com" {
		t.Errorf("r2: host=%q base=%q", host, base)
	}
}

// TestS3SignSetsHeaders confirms signing attaches the expected headers and an
// Authorization value with the right structure.
func TestS3SignSetsHeaders(t *testing.T) {
	req, err := http.NewRequest(http.MethodPut, "https://s3.us-east-1.amazonaws.com/bucket/key.txt", strings.NewReader("hello"))
	if err != nil {
		t.Fatal(err)
	}
	if err := s3Sign(req, "AKIDEXAMPLE", "secret", "us-east-1", "s3.us-east-1.amazonaws.com", []byte("hello")); err != nil {
		t.Fatal(err)
	}
	if req.Header.Get("X-Amz-Date") == "" {
		t.Error("missing X-Amz-Date")
	}
	if req.Header.Get("X-Amz-Content-Sha256") == "" {
		t.Error("missing X-Amz-Content-Sha256")
	}
	auth := req.Header.Get("Authorization")
	for _, part := range []string{"AWS4-HMAC-SHA256", "Credential=AKIDEXAMPLE/", "SignedHeaders=host;x-amz-content-sha256;x-amz-date", "Signature="} {
		if !strings.Contains(auth, part) {
			t.Errorf("Authorization missing %q: %s", part, auth)
		}
	}
}

func hexLower(b []byte) string {
	const hexdigits = "0123456789abcdef"
	out := make([]byte, len(b)*2)
	for i, v := range b {
		out[i*2] = hexdigits[v>>4]
		out[i*2+1] = hexdigits[v&0x0f]
	}
	return string(out)
}

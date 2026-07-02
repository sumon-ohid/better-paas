package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/term"
)

func chooseProfile(defaultName string) (string, error) {
	fmt.Println()
	fmt.Println("Choose a scope profile:")
	for i, name := range profileNames() {
		p := profiles[name]
		marker := " "
		if name == defaultName {
			marker = "*"
		}
		fmt.Printf("  %s %d) %-9s — %s\n", marker, i+1, name, p.Description)
	}
	fmt.Printf("Profile [%s]: ", defaultName)

	line, err := readLine()
	if err != nil {
		return "", err
	}
	line = strings.TrimSpace(strings.ToLower(line))
	if line == "" {
		return defaultName, nil
	}
	if n := parseChoice(line); n >= 1 && n <= len(profileNames()) {
		return profileNames()[n-1], nil
	}
	if _, ok := profileByName(line); ok {
		return line, nil
	}
	return "", fmt.Errorf("unknown profile %q", line)
}

func parseChoice(s string) int {
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}

func promptLine(label, defaultValue string) (string, error) {
	if defaultValue != "" {
		fmt.Printf("%s [%s]: ", label, defaultValue)
	} else {
		fmt.Printf("%s: ", label)
	}
	line, err := readLine()
	if err != nil {
		return "", err
	}
	line = strings.TrimSpace(line)
	if line == "" {
		return defaultValue, nil
	}
	return line, nil
}

func readLine() (string, error) {
	in := bufio.NewReader(os.Stdin)
	line, err := in.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}

func readSecret(prompt string) (string, error) {
	fmt.Print(prompt)
	if term.IsTerminal(int(os.Stdin.Fd())) {
		b, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Println()
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
	return readLine()
}

func splitConnectArgs(args []string) (url string, flagArgs []string) {
	flagValue := map[string]bool{
		"-admin-token": true, "--admin-token": true,
		"-profile": true, "--profile": true,
		"-name": true, "--name": true,
		"-ui": true, "--ui": true,
		"-legacy": true, "--legacy": true,
	}
	var urlParts []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		if strings.HasPrefix(a, "-") {
			flagArgs = append(flagArgs, a)
			if flagValue[a] && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				i++
				flagArgs = append(flagArgs, args[i])
			}
			continue
		}
		urlParts = append(urlParts, a)
	}
	return strings.TrimSpace(strings.Join(urlParts, " ")), flagArgs
}

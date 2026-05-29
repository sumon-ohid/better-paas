package main

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	// The platform injects PORT; bind to it on all interfaces (0.0.0.0).
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	hostname, _ := os.Hostname()

	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"app":      "go-gin",
			"message":  "Hello from Go + Gin on the BaaS platform",
			"hostname": hostname,
			"time":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.Run("0.0.0.0:" + port)
}

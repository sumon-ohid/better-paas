<?php

header("Content-Type: application/json");

$path = parse_url($_SERVER["REQUEST_URI"] ?? "/", PHP_URL_PATH);

if ($path === "/health") {
    http_response_code(200);
    echo json_encode(["status" => "ok"]);
    exit;
}

echo json_encode([
    "app" => "php-vanilla",
    "message" => "Hello from PHP on the BaaS platform",
    "hostname" => gethostname(),
    "time" => gmdate("c"),
]);

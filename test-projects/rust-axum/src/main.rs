use std::env;

use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

async fn index() -> Json<Value> {
    let hostname = env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string());
    Json(json!({
        "app": "rust-axum",
        "message": "Hello from Rust + axum on the BaaS platform",
        "hostname": hostname,
    }))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

#[tokio::main]
async fn main() {
    // The platform injects PORT; bind to it on all interfaces (0.0.0.0).
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{port}");

    let app = Router::new()
        .route("/", get(index))
        .route("/health", get(health));

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("rust-axum listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}

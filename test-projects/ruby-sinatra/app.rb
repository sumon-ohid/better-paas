require "sinatra"
require "json"
require "socket"

# The platform injects PORT; bind to it on all interfaces (0.0.0.0).
set :bind, "0.0.0.0"
set :port, (ENV["PORT"] || "4567").to_i

get "/" do
  content_type :json
  {
    app: "ruby-sinatra",
    message: "Hello from Ruby + Sinatra on the BaaS platform",
    hostname: Socket.gethostname,
    time: Time.now.utc.iso8601,
  }.to_json
end

get "/health" do
  content_type :json
  { status: "ok" }.to_json
end

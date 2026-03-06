from flask import Flask

# Initialize the Flask application
app = Flask(__name__)

# Define a route for the default URL ("/")
@app.route("/")
def hello_world():
    return "<h1>Hello, World!</h1><p>Watchtower is active.</p>"

if __name__ == "__main__":
    # Run the app in debug mode for easier development
    app.run(debug=True)

from flask import Flask, request, jsonify
from flask_cors import CORS
import pyrebase

firebaseConfig = {
  'apiKey': "AIzaSyDHUva_43LCpiqfN93UQp_I9hMODLvhIPM",
  'authDomain': "how-s-my-terrain.firebaseapp.com",
  'databaseURL': "https://how-s-my-terrain-default-rtdb.europe-west1.firebasedatabase.app",
  'projectId': "how-s-my-terrain",
  'storageBucket': "how-s-my-terrain.firebasestorage.app",
  'messagingSenderId': "851955960749",
  'appId': "1:851955960749:web:2493ba8d3d50c84a0d2f24"
}

firebase = pyrebase.initialize_app(firebaseConfig)
auth = firebase.auth()

app = Flask(__name__)
CORS(app)

@app.route('/home')
def home():
    return 'Hello'

# Register user endpoint
@app.route('/register', methods=['POST'])
def register_user():
  try:
    # Extract email and password from the request
    data = request.json
    email = data.get("email")
    password = data.get("password")

    # Check if an account with the email already exists
    try:
      auth.get_user_by_email(email)  # This will raise an error if the user does not exist
      return jsonify({"status": "fail", "message": "An account with this email already exists"}), 400
    except:
      # If no account exists, create a new user
      user = auth.create_user_with_email_and_password(email, password)
      return jsonify({"status": "success", "message": "User registered successfully", "user": user}), 201

  except Exception as e:
    print(str(e))
    return jsonify({"status": "fail", "message": str(e)}), 400

# Login user endpoint
@app.route('/login', methods=['POST'])
def login_user():
    try:
        # Extract email and password from the request
        data = request.json
        email = data.get("email")
        password = data.get("password")

        # Sign in the user
        user = auth.sign_in_with_email_and_password(email, password)
        return jsonify({"status": "success", "message": "Login successful", "user": user}), 200

    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 401

if __name__ == '__main__':
    app.run(debug=True)
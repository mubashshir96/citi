import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

/* 🔴 APNA REAL FIREBASE CONFIG DALO */
const firebaseConfig = {
  apiKey: "AIzaSyDArQkJaFoPMQeOoHi1LQPB2Umm4LS8oK8",
  authDomain: "to-1-chat-a9582.firebaseapp.com",
  databaseURL: "https://to-1-chat-a9582-default-rtdb.firebaseio.com",
  projectId: "to-1-chat-a9582"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* 🔹 GLOBAL FUNCTIONS (VERY IMPORTANT) */
window.login = function () {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(startChat)
    .catch(err => alert(err.message));
};

window.register = function () {
  createUserWithEmailAndPassword(auth, email.value, password.value)
    .then(startChat)
    .catch(err => alert(err.message));
};

function startChat() {
  login.style.display = "none";
  chat.style.display = "block";

  const msgRef = ref(db, "messages");
  onChildAdded(msgRef, snap => {
    messages.innerHTML += `<div>${snap.val().text}</div>`;
  });
}

window.sendMsg = function () {
  push(ref(db, "messages"), {
    text: msg.value
  });
  msg.value = "";
};

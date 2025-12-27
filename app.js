import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword }
from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded }
from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDArQkJaFoPMQeOoHi1LQPB2Umm4LS8oK8",
  authDomain: "to-1-chat-a9582.firebaseapp.com",
  databaseURL: "https://to-1-chat-a9582-default-rtdb.firebaseio.com",
  projectId: "to-1-chat-a9582"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 🔴 expose functions to HTML
window.login = () => {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(startChat)
    .catch(e => alert(e.message));
};

window.register = () => {
  createUserWithEmailAndPassword(auth, email.value, password.value)
    .then(startChat)
    .catch(e => alert(e.message));
};

function startChat() {
  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";

  onChildAdded(ref(db, "messages"), snap => {
    document.getElementById("messages").innerHTML +=
      `<div>${snap.val().text}</div>`;
  });
}

window.sendMsg = () => {
  push(ref(db, "messages"), { text: msg.value });
  msg.value = "";
};

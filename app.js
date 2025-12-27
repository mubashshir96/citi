/* ================= FIREBASE IMPORTS ================= */
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
  onChildAdded,
  onValue,
  set,
  update,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

/* ================= FIREBASE API CONFIG ================= */
/* 🔴 YAHI WO API HAI JISKI ERROR AA RAHI THI */
const firebaseConfig = {
  apiKey: "AIzaSyDArQkJaFoPMQeOoHi1LQPB2Umm4LS8oK8",
  authDomain: "to-1-chat-a9582.firebaseapp.com",
  databaseURL: "https://to-1-chat-a9582-default-rtdb.firebaseio.com",
  projectId: "to-1-chat-a9582",
  storageBucket: "to-1-chat-a9582.firebasestorage.app",
  messagingSenderId: "382335872296",
  appId: "1:382335872296:web:25d06c77d19f45688df41d"
};

/* ================= INIT ================= */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ================= AES ENCRYPTION ================= */
const SECRET = "whatsapp-secret";

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, SECRET).toString();
}

function decrypt(cipher) {
  return CryptoJS.AES.decrypt(cipher, SECRET)
    .toString(CryptoJS.enc.Utf8);
}

/* ================= GLOBALS ================= */
let currentChatId = "";
let currentOtherUid = "";

/* ================= AUTH ================= */
window.login = () => {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(startApp)
    .catch(e => alert(e.message));
};

window.register = () => {
  createUserWithEmailAndPassword(auth, email.value, password.value)
    .then(startApp)
    .catch(e => alert(e.message));
};

/* ================= START APP ================= */
function startApp() {
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "flex";

  set(ref(db, "users/" + auth.currentUser.uid), {
    email: auth.currentUser.email,
    online: true
  });

  onDisconnect(ref(db, "users/" + auth.currentUser.uid + "/online"))
    .set(false);

  loadUsers();
}

/* ================= LOAD USERS ================= */
function loadUsers() {
  onValue(ref(db, "users"), snap => {
    userList.innerHTML = "";
    snap.forEach(u => {
      if (u.key !== auth.currentUser.uid) {
        const d = document.createElement("div");
        d.innerText = u.val().email;
        d.onclick = () => openChat(u.key, u.val().email);
        userList.appendChild(d);
      }
    });
  });
}

/* ================= CHAT ID ================= */
function getChatId(a, b) {
  return a < b ? a + "_" + b : b + "_" + a;
}

/* ================= OPEN CHAT ================= */
function openChat(uid, email) {
  currentOtherUid = uid;
  currentChatId = getChatId(auth.currentUser.uid, uid);
  chatWith.innerText = email;
  messages.innerHTML = "";

  onChildAdded(
    ref(db, "chats/" + currentChatId + "/messages"),
    snap => {
      const m = snap.val();

      if (m.sender !== auth.currentUser.uid) {
        update(
          ref(db, "chats/" + currentChatId + "/messages/" + snap.key),
          { seen: true }
        );
      }

      addMessage({
        text: decrypt(m.text),
        sender: m.sender,
        seen: m.seen
      });
    }
  );
}

/* ================= MESSAGE UI ================= */
function addMessage(m) {
  const d = document.createElement("div");
  d.className = "msg " + (m.sender === auth.currentUser.uid ? "me" : "other");
  d.innerText =
    m.text +
    (m.sender === auth.currentUser.uid ? (m.seen ? " ✔✔" : " ✔") : "");
  messages.appendChild(d);
}

/* ================= SEND MESSAGE ================= */
window.sendMsg = () => {
  if (!currentChatId) {
    alert("Select a user first");
    return;
  }

  const text = msg.value.trim();
  if (!text) return;

  push(ref(db, "chats/" + currentChatId + "/messages"), {
    text: encrypt(text),
    sender: auth.currentUser.uid,
    seen: false,
    time: Date.now()
  });

  msg.value = "";
};

/* ================= DARK MODE ================= */
window.toggleDark = () => {
  document.body.classList.toggle("dark");
};

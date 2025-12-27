import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { onValue } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword }
from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, set, remove, onDisconnect }
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

let chatId = "public"; // abhi demo ke liye

/* ---------- AUTH ---------- */
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
set(ref(db, "users/" + auth.currentUser.uid), {
  email: auth.currentUser.email,
  online: true
});
onValue(ref(db, "users"), snap => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  snap.forEach(u => {
    if (u.key !== auth.currentUser.uid) {
      const d = document.createElement("div");
      d.innerText = u.val().email;
      d.onclick = () => openChat(u.key);
      userList.appendChild(d);
    }
  });
});

/* ---------- CHAT START ---------- */
function getChatId(a, b) {
  return a < b ? a + "_" + b : b + "_" + a;
}

let currentChatId = "";

function openChat(otherUid) {
  currentChatId = getChatId(auth.currentUser.uid, otherUid);
  document.getElementById("messages").innerHTML = "";

  onChildAdded(
    ref(db, "chats/" + currentChatId + "/messages"),
    snap => {
      const m = snap.val();
      addMessage({
        text: decrypt(m.text),
        sender: m.sender
      });
    }
  );
}

function startChat() {
  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "flex";

  set(ref(db,"online/"+auth.currentUser.uid), true);
  onDisconnect(ref(db,"online/"+auth.currentUser.uid)).remove();

  onChildAdded(ref(db,"chats/"+chatId+"/messages"), snap => {
    const m = snap.val();
    addMessage(m);
  });
}

/* ---------- MESSAGE UI ---------- */
function addMessage(m) {
  const div = document.createElement("div");
  div.className = "msg " + (m.sender === auth.currentUser.uid ? "me" : "other");

  if (m.img) {
    const img = document.createElement("img");
    img.src = m.img;
    img.style.maxWidth="150px";
    div.appendChild(img);
  } else {
    div.innerText = m.text;
  }

  messages.appendChild(div);
}
const SECRET = "whatsapp-secret";

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, SECRET).toString();
}

function decrypt(cipher) {
  return CryptoJS.AES.decrypt(cipher, SECRET).toString(CryptoJS.enc.Utf8);
}


/* ---------- SEND MESSAGE ---------- */
window.sendMsg = () => {
  if (img.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      push(ref(db,"chats/"+chatId+"/messages"), {
        img: reader.result,
        sender: auth.currentUser.uid
      });
    };
    reader.readAsDataURL(img.files[0]);
  } else {
    push(ref(db,"chats/"+chatId+"/messages"), {
      text: msg.value,
      sender: auth.currentUser.uid
    });
  }
  msg.value="";
  img.value="";
};

/* ---------- TYPING ---------- */
msg.oninput = () => {
  set(ref(db,"typing/"+chatId+"/"+auth.currentUser.uid), true);
  setTimeout(()=>remove(ref(db,"typing/"+chatId+"/"+auth.currentUser.uid)),1000);
};

/* ---------- WEBRTC CALL ---------- */
let pc = new RTCPeerConnection();
window.startCall = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  localVideo.srcObject = stream;
  stream.getTracks().forEach(t=>pc.addTrack(t,stream));
};

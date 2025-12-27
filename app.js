
const firebaseConfig = {
 apiKey: "AIzaSyDArQkJaFoPMQeOoHi1LQPB2Umm4LS8oK8",
 authDomain: "to-1-chat-a9582.firebaseapp.com",
 databaseURL: "https://to-1-chat-a9582-default-rtdb.firebaseio.com",
 projectId: "to-1-chat-a9582"
};
firebase.initializeApp(firebaseConfig);

const auth=firebase.auth();
const db=firebase.database();
let uid;

function login(){
 auth.signInWithEmailAndPassword(email.value,password.value).then(u=>start(u.user.uid));
}
function register(){
 auth.createUserWithEmailAndPassword(email.value,password.value).then(u=>start(u.user.uid));
}

function start(id){
 uid=id;
 login.style.display="none";
 chat.style.display="block";
 db.ref("online/"+uid).set(true);
 db.ref("messages").on("child_added",s=>{
  const m=s.val();
  if(m.type==="img") messages.innerHTML+=`<img src="${m.text}">`;
  else messages.innerHTML+=`<div>${m.text}</div>`;
 });
}

function typing(){
 db.ref("typing/"+uid).set(true);
 setTimeout(()=>db.ref("typing/"+uid).remove(),1000);
}

function sendMsg(){
 if(img.files[0]){
  const reader=new FileReader();
  reader.onload=()=>db.ref("messages").push({text:reader.result,type:"img"});
  reader.readAsDataURL(img.files[0]);
 }else{
  db.ref("messages").push({text:msg.value,type:"text"});
 }
 msg.value="";
 img.value="";
}

// Simple WebRTC demo
let pc=new RTCPeerConnection();
async function startCall(){
 const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
 localVideo.srcObject=stream;
 stream.getTracks().forEach(t=>pc.addTrack(t,stream));
}

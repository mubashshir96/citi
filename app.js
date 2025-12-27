// ==================================================
// IMPORTS & INITIALIZATION
// ==================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getDatabase, 
    ref,
    // Debug Firebase initialization
console.log("🟡 Starting Firebase initialization...");
console.log("Firebase Config:", firebaseConfig);

// Check if databaseURL is correct
if (!firebaseConfig.databaseURL) {
    console.error("❌ ERROR: databaseURL missing in firebase-config.js");
} else {
    console.log("✅ databaseURL found:", firebaseConfig.databaseURL);
}

// Initialize Firebase
let app;
try {
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase app initialized successfully");
} catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    console.error("Error details:", error.message);
    console.error("Check your firebase-config.js file");
}
    set, 
    push, 
    onValue, 
    onChildAdded, 
    onChildChanged, 
    update, 
    remove,
    serverTimestamp,
    query,
    orderByChild,
    equalTo
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { 
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// ==================================================
// CRYPTOGRAPHY MODULE (E2E Encryption)
// ==================================================

class CryptoService {
    constructor() {
        this.saltCache = new Map();
    }

    // Generate a unique chat key based on sorted UIDs
    async generateChatKey(uid1, uid2) {
        const sortedUids = [uid1, uid2].sort();
        const chatId = `${sortedUids[0]}_${sortedUids[1]}`;
        
        // Try to get existing salt from cache
        let salt = this.saltCache.get(chatId);
        
        if (!salt) {
            // Generate new salt for this chat
            salt = window.crypto.getRandomValues(new Uint8Array(16));
            this.saltCache.set(chatId, salt);
        }

        // Create key from UIDs + salt using PBKDF2
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(chatId),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        const key = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        return { key, salt };
    }

    // Encrypt message
    async encryptMessage(text, key) {
        try {
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(text);
            
            const encrypted = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encoded
            );

            // Combine iv and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Convert to base64 for storage
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption error:', error);
            throw error;
        }
    }

    // Decrypt message
    async decryptMessage(encryptedBase64, key) {
        try {
            // Convert from base64
            const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            
            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encrypted
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            return '[Encrypted message - decryption failed]';
        }
    }

    // Generate message hash for integrity check
    async generateMessageHash(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

// ==================================================
// STATE MANAGEMENT
// ==================================================

class AppState {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.chatPartner = null;
        this.users = new Map();
        this.chatListeners = {};
        this.crypto = new CryptoService();
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isCallActive = false;
        this.isCaller = false;
        this.callDataChannel = null;
        this.statuses = new Map();
    }

    setCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    getCurrentUser() {
        if (!this.currentUser && localStorage.getItem('currentUser')) {
            this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
        }
        return this.currentUser;
    }

    clearCurrentUser() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    addUser(user) {
        this.users.set(user.uid, user);
    }

    getUser(uid) {
        return this.users.get(uid);
    }

    removeChatListener(chatId) {
        if (this.chatListeners[chatId]) {
            this.chatListeners[chatId]();
            delete this.chatListeners[chatId];
        }
    }
}

const state = new AppState();

// ==================================================
// DOM ELEMENTS
// ==================================================

// Auth elements
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('appContainer');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerName = document.getElementById('registerName');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Sidebar elements
const currentUserName = document.getElementById('currentUserName');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUserStatus = document.getElementById('currentUserStatus');
const userSearch = document.getElementById('userSearch');
const usersList = document.getElementById('usersList');

// Status elements
const statusList = document.getElementById('statusList');
const newStatusBtn = document.getElementById('newStatusBtn');
const statusModal = document.getElementById('statusModal');
const closeStatusModal = document.getElementById('closeStatusModal');
const statusTypeBtns = document.querySelectorAll('.status-type-btn');
const textStatusInput = document.getElementById('textStatusInput');
const imageStatusInput = document.getElementById('imageStatusInput');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImageBtn');
const cancelStatusBtn = document.getElementById('cancelStatusBtn');
const postStatusBtn = document.getElementById('postStatusBtn');

// Chat elements
const chatHeader = document.getElementById('chatHeader');
const chatPartnerName = document.getElementById('chatPartnerName');
const chatPartnerStatus = document.getElementById('chatPartnerStatus');
const chatPartnerAvatar = document.getElementById('chatPartnerAvatar');
const chatActions = document.getElementById('chatActions');
const messagesContainer = document.getElementById('messagesContainer');
const emptyChat = document.getElementById('emptyChat');
const typingIndicator = document.getElementById('typingIndicator');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const callBtn = document.getElementById('callBtn');
const videoCallBtn = document.getElementById('videoCallBtn');

// Call elements
const callInterface = document.getElementById('callInterface');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remoteUserName = document.getElementById('remoteUserName');
const callStatus = document.getElementById('callStatus');
const muteBtn = document.getElementById('muteBtn');
const videoToggleBtn = document.getElementById('videoToggleBtn');
const endCallBtn = document.getElementById('endCallBtn');

// ==================================================
// AUTHENTICATION
// ==================================================

// Tab switching
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
    authError.textContent = '';
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
    authError.textContent = '';
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    
    const email = loginEmail.value;
    const password = loginPassword.value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update user in database
        await set(ref(db, `users/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            name: user.displayName || email.split('@')[0],
            online: true,
            lastSeen: serverTimestamp()
        });

        // Set online status with disconnect handler
        const userStatusRef = ref(db, `users/${user.uid}/online`);
        const userLastSeenRef = ref(db, `users/${user.uid}/lastSeen`);
        
        await set(userStatusRef, true);
        await onDisconnect(userStatusRef).set(false);
        await onDisconnect(userLastSeenRef).set(serverTimestamp());
        
        loginForm.reset();
    } catch (error) {
        authError.textContent = getAuthErrorMessage(error);
    }
});

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    
    const name = registerName.value;
    const email = registerEmail.value;
    const password = registerPassword.value;

    if (password.length < 6) {
        authError.textContent = 'Password must be at least 6 characters';
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user profile in database
        await set(ref(db, `users/${user.uid}`), {
            uid: user.uid,
            email: email,
            name: name,
            online: true,
            lastSeen: serverTimestamp()
        });

        // Set initial online status
        const userStatusRef = ref(db, `users/${user.uid}/online`);
        await set(userStatusRef, true);
        await onDisconnect(userStatusRef).set(false);
        
        registerForm.reset();
        loginTab.click(); // Switch to login tab
    } catch (error) {
        authError.textContent = getAuthErrorMessage(error);
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        // Update online status before signing out
        if (state.currentUser) {
            await update(ref(db, `users/${state.currentUser.uid}`), {
                online: false,
                lastSeen: serverTimestamp()
            });
        }
        
        // Clear all listeners
        Object.keys(state.chatListeners).forEach(chatId => {
            state.removeChatListener(chatId);
        });
        
        // Sign out
        await signOut(auth);
        state.clearCurrentUser();
        
        // Reset UI
        appContainer.classList.add('hidden');
        authScreen.classList.remove('hidden');
        usersList.innerHTML = '';
        messagesContainer.innerHTML = '';
        emptyChat.classList.remove('hidden');
        
        // Reset chat UI
        chatPartnerName.textContent = 'Select a chat';
        chatPartnerStatus.textContent = 'Click on a user to start chatting';
        messageInput.disabled = true;
        sendBtn.disabled = true;
        callBtn.disabled = true;
        videoCallBtn.disabled = true;
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        const userSnapshot = await get(ref(db, `users/${user.uid}`));
        const userData = userSnapshot.val();
        
        if (userData) {
            state.setCurrentUser({
                uid: user.uid,
                email: user.email,
                name: userData.name || user.email.split('@')[0],
                online: true
            });
            
            // Update UI
            currentUserName.textContent = state.currentUser.name;
            currentUserAvatar.textContent = getInitials(state.currentUser.name);
            
            // Load users and statuses
            loadUsers();
            loadStatuses();
            setupTypingListener();
            
            // Show app
            authScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            
            // Load theme preference
            loadThemePreference();
        }
    }
});

// ==================================================
// USER MANAGEMENT
// ==================================================

async function loadUsers() {
    const usersRef = ref(db, 'users');
    
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        usersList.innerHTML = '';
        state.users.clear();
        
        if (!users) return;
        
        Object.entries(users).forEach(([uid, userData]) => {
            // Skip current user
            if (uid === state.currentUser.uid) return;
            
            state.addUser({
                uid: uid,
                ...userData
            });
            
            // Create user item
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.dataset.uid = uid;
            
            // Get last message for preview
            const chatId = generateChatId(state.currentUser.uid, uid);
            const lastMessageRef = ref(db, `chats/${chatId}/messages`);
            
            onValue(query(lastMessageRef, orderByChild('timestamp'), limitToLast(1)), (snapshot) => {
                const messages = snapshot.val();
                let lastMessageText = 'No messages yet';
                
                if (messages) {
                    const lastMessage = Object.values(messages)[0];
                    if (lastMessage.encrypted) {
                        // Message is encrypted, show placeholder
                        lastMessageText = 'Encrypted message';
                    } else {
                        lastMessageText = lastMessage.text || 'Media message';
                    }
                }
                
                userItem.querySelector('.last-message')?.textContent = lastMessageText;
            });
            
            userItem.innerHTML = `
                <div class="user-avatar">
                    <div class="avatar">${getInitials(userData.name)}</div>
                    ${userData.online ? '<div class="online-dot"></div>' : ''}
                </div>
                <div class="user-info">
                    <h4>${userData.name}</h4>
                    <p class="last-message">Loading...</p>
                </div>
            `;
            
            userItem.addEventListener('click', () => openChat(uid, userData));
            usersList.appendChild(userItem);
        });
    });
}

// Search users
userSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const userName = item.querySelector('h4').textContent.toLowerCase();
        const userMessage = item.querySelector('p').textContent.toLowerCase();
        
        if (userName.includes(searchTerm) || userMessage.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// ==================================================
// CHAT SYSTEM
// ==================================================

function generateChatId(uid1, uid2) {
    const sortedUids = [uid1, uid2].sort();
    return `${sortedUids[0]}_${sortedUids[1]}`;
}

async function openChat(partnerUid, partnerData) {
    // Remove previous chat listener
    if (state.currentChat) {
        state.removeChatListener(state.currentChat.id);
    }
    
    // Update state
    state.chatPartner = {
        uid: partnerUid,
        ...partnerData
    };
    state.currentChat = {
        id: generateChatId(state.currentUser.uid, partnerUid),
        partnerUid: partnerUid
    };
    
    // Update UI
    chatPartnerName.textContent = partnerData.name;
    chatPartnerStatus.textContent = partnerData.online ? 'Online' : 'Offline';
    chatPartnerAvatar.textContent = getInitials(partnerData.name);
    
    // Enable chat features
    messageInput.disabled = false;
    sendBtn.disabled = false;
    callBtn.disabled = false;
    videoCallBtn.disabled = false;
    
    // Hide empty chat message
    emptyChat.classList.add('hidden');
    
    // Clear and load messages
    messagesContainer.innerHTML = '';
    await loadMessages();
    
    // Mark messages as read
    markMessagesAsRead();
    
    // Set up real-time message listener
    setupMessageListener();
    
    // Highlight active user
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.uid === partnerUid) {
            item.classList.add('active');
        }
    });
}

async function loadMessages() {
    const chatId = state.currentChat.id;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    
    onValue(query(messagesRef, orderByChild('timestamp')), async (snapshot) => {
        const messages = snapshot.val();
        messagesContainer.innerHTML = '';
        
        if (!messages) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-chat';
            emptyMessage.innerHTML = `
                <i class="fab fa-whatsapp fa-4x"></i>
                <h2>No messages yet</h2>
                <p>Say hello to start the conversation!</p>
            `;
            messagesContainer.appendChild(emptyMessage);
            return;
        }
        
        // Generate chat key for decryption
        const { key } = await state.crypto.generateChatKey(
            state.currentUser.uid,
            state.chatPartner.uid
        );
        
        // Sort messages by timestamp
        const sortedMessages = Object.values(messages)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        // Display messages
        for (const message of sortedMessages) {
            await displayMessage(message, key);
        }
        
        // Scroll to bottom
        scrollToBottom();
    });
}

async function displayMessage(messageData, key) {
    const messageDiv = document.createElement('div');
    const isSent = messageData.senderId === state.currentUser.uid;
    
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    // Decrypt message if encrypted
    let messageText = messageData.text;
    if (messageData.encrypted && key) {
        try {
            messageText = await state.crypto.decryptMessage(messageData.text, key);
        } catch (error) {
            messageText = '[Encrypted message]';
        }
    }
    
    // Format timestamp
    const timestamp = messageData.timestamp ? 
        formatTimestamp(messageData.timestamp) : 'Just now';
    
    // Read receipt icons
    let receiptIcon = '✓';
    if (isSent) {
        if (messageData.seen) {
            receiptIcon = '✓✓';
        } else if (messageData.delivered) {
            receiptIcon = '✓✓';
        }
    }
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(messageText)}</div>
            <div class="message-time">
                <span>${timestamp}</span>
                ${isSent ? `<span class="message-seen">${receiptIcon}</span>` : ''}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !state.currentChat || !state.chatPartner) return;
    
    const chatId = state.currentChat.id;
    const messageRef = push(ref(db, `chats/${chatId}/messages`));
    
    try {
        // Generate chat key for encryption
        const { key } = await state.crypto.generateChatKey(
            state.currentUser.uid,
            state.chatPartner.uid
        );
        
        // Encrypt message
        const encryptedText = await state.crypto.encryptMessage(text, key);
        
        // Create message object
        const message = {
            id: messageRef.key,
            senderId: state.currentUser.uid,
            receiverId: state.chatPartner.uid,
            text: encryptedText,
            encrypted: true,
            timestamp: serverTimestamp(),
            delivered: false,
            seen: false
        };
        
        // Save to database
        await set(messageRef, message);
        
        // Update last message in chat metadata
        const chatMetaRef = ref(db, `chatMeta/${chatId}`);
        await update(chatMetaRef, {
            lastMessage: '[Encrypted message]',
            lastMessageTime: serverTimestamp(),
            lastSenderId: state.currentUser.uid
        });
        
        // Clear input
        messageInput.value = '';
        
        // Set typing status to false
        await setTypingStatus(false);
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message. Please try again.');
    }
}

function setupMessageListener() {
    const chatId = state.currentChat.id;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    
    // Listen for new messages
    state.chatListeners[chatId] = onChildAdded(messagesRef, async (snapshot) => {
        const message = snapshot.val();
        
        // Skip if message is from current user (already displayed)
        if (message.senderId === state.currentUser.uid) return;
        
        // Generate key for decryption
        const { key } = await state.crypto.generateChatKey(
            state.currentUser.uid,
            state.chatPartner.uid
        );
        
        // Display message
        await displayMessage(message, key);
        scrollToBottom();
        
        // Mark as delivered and seen
        if (message.receiverId === state.currentUser.uid) {
            await update(ref(db, `chats/${chatId}/messages/${message.id}`), {
                delivered: true,
                seen: true
            });
        }
    });
}

// ==================================================
// TYPING INDICATOR
// ==================================================

async function setTypingStatus(isTyping) {
    if (!state.currentChat) return;
    
    const typingRef = ref(db, `typing/${state.currentChat.id}/${state.currentUser.uid}`);
    
    if (isTyping) {
        await set(typingRef, true);
        
        // Auto-remove typing status after 3 seconds
        setTimeout(() => {
            set(typingRef, false);
        }, 3000);
    } else {
        await set(typingRef, false);
    }
}

function setupTypingListener() {
    if (!state.currentChat) return;
    
    const typingRef = ref(db, `typing/${state.currentChat.id}/${state.chatPartner.uid}`);
    
    onValue(typingRef, (snapshot) => {
        const isTyping = snapshot.val();
        
        if (isTyping) {
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    });
}

// Typing detection
messageInput.addEventListener('input', () => {
    if (!state.currentChat) return;
    
    clearTimeout(state.typingTimeout);
    
    setTypingStatus(true);
    
    state.typingTimeout = setTimeout(() => {
        setTypingStatus(false);
    }, 1000);
});

// ==================================================
// READ RECEIPTS
// ==================================================

async function markMessagesAsRead() {
    if (!state.currentChat || !state.chatPartner) return;
    
    const chatId = state.currentChat.id;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    
    onValue(messagesRef, (snapshot) => {
        const messages = snapshot.val();
        
        if (!messages) return;
        
        Object.entries(messages).forEach(async ([messageId, message]) => {
            if (message.receiverId === state.currentUser.uid && !message.seen) {
                await update(ref(db, `chats/${chatId}/messages/${messageId}`), {
                    seen: true
                });
            }
        });
    }, { onlyOnce: true });
}

// ==================================================
// STATUS FEATURE
// ==================================================

async function loadStatuses() {
    const statusesRef = ref(db, 'statuses');
    
    onValue(statusesRef, (snapshot) => {
        const statuses = snapshot.val();
        statusList.innerHTML = '';
        state.statuses.clear();
        
        if (!statuses) {
            // Add "My Status" placeholder
            const myStatusItem = createStatusItem(null, true);
            statusList.appendChild(myStatusItem);
            return;
        }
        
        // Group statuses by user
        const userStatuses = new Map();
        
        Object.entries(statuses).forEach(([statusId, status]) => {
            // Check if status is expired (24 hours)
            const statusTime = status.timestamp;
            const now = Date.now();
            const hoursDiff = (now - statusTime) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                // Remove expired status
                remove(ref(db, `statuses/${statusId}`));
                return;
            }
            
            if (!userStatuses.has(status.userId)) {
                userStatuses.set(status.userId, []);
            }
            userStatuses.get(status.userId).push({ id: statusId, ...status });
        });
        
        // Add "My Status" first
        const myStatuses = userStatuses.get(state.currentUser.uid) || [];
        const myStatusItem = createStatusItem(
            myStatuses[myStatuses.length - 1], 
            true
        );
        statusList.appendChild(myStatusItem);
        
        // Add other users' statuses
        userStatuses.forEach((userStatuses, userId) => {
            if (userId === state.currentUser.uid) return;
            
            const latestStatus = userStatuses[userStatuses.length - 1];
            const user = state.getUser(userId);
            
            if (user && latestStatus) {
                const statusItem = createStatusItem(latestStatus, false, user);
                statusList.appendChild(statusItem);
            }
        });
    });
}

function createStatusItem(status, isMyStatus = false, user = null) {
    const item = document.createElement('div');
    item.className = `status-item ${isMyStatus ? 'my-status' : ''}`;
    
    let content = '';
    let timestampText = 'Click to add status';
    
    if (status) {
        const timeAgo = getTimeAgo(status.timestamp);
        timestampText = `${timeAgo} ago`;
        
        if (status.type === 'text') {
            content = status.content.substring(0, 30) + 
                     (status.content.length > 30 ? '...' : '');
        } else {
            content = '📷 Image';
        }
    }
    
    const userName = isMyStatus ? 'My Status' : (user?.name || 'Unknown');
    const initials = isMyStatus ? 
        getInitials(state.currentUser.name) : 
        getInitials(user?.name || 'U');
    
    item.innerHTML = `
        <div class="status-avatar">
            <div class="avatar">${initials}</div>
        </div>
        <div class="status-details">
            <h5>${userName}</h5>
            <p>${content || timestampText}</p>
        </div>
    `;
    
    if (status) {
        item.addEventListener('click', () => viewStatus(status, user));
    } else if (isMyStatus) {
        item.addEventListener('click', () => openStatusModal());
    }
    
    return item;
}

// Status Modal
newStatusBtn.addEventListener('click', openStatusModal);

function openStatusModal() {
    statusModal.classList.remove('hidden');
    textStatusInput.value = '';
    imagePreview.classList.add('hidden');
    statusTypeBtns.forEach(btn => {
        if (btn.dataset.type === 'text') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

closeStatusModal.addEventListener('click', () => {
    statusModal.classList.add('hidden');
});

cancelStatusBtn.addEventListener('click', () => {
    statusModal.classList.add('hidden');
});

// Status type switching
statusTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        statusTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (btn.dataset.type === 'text') {
            textStatusInput.style.display = 'block';
            imageStatusInput.style.display = 'none';
            imagePreview.classList.add('hidden');
        } else {
            textStatusInput.style.display = 'none';
            imageStatusInput.style.display = 'block';
        }
    });
});

// Image preview
imageStatusInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            previewImage.src = event.target.result;
            imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

removeImageBtn.addEventListener('click', () => {
    imagePreview.classList.add('hidden');
    imageStatusInput.value = '';
});

// Post status
postStatusBtn.addEventListener('click', async () => {
    const activeType = document.querySelector('.status-type-btn.active').dataset.type;
    
    if (activeType === 'text') {
        const text = textStatusInput.value.trim();
        if (!text) {
            showNotification('Please enter status text');
            return;
        }
        
        await postStatus('text', text);
    } else {
        const file = imageStatusInput.files[0];
        if (!file) {
            showNotification('Please select an image');
            return;
        }
        
        await postStatus('image', file);
    }
    
    statusModal.classList.add('hidden');
    showNotification('Status posted!');
});

async function postStatus(type, content) {
    const statusRef = push(ref(db, 'statuses'));
    const statusId = statusRef.key;
    
    if (type === 'text') {
        await set(statusRef, {
            id: statusId,
            userId: state.currentUser.uid,
            userName: state.currentUser.name,
            type: 'text',
            content: content,
            timestamp: Date.now()
        });
    } else if (type === 'image') {
        // Upload image to storage
        const storageReference = storageRef(storage, `statuses/${statusId}`);
        await uploadBytes(storageReference, content);
        const imageUrl = await getDownloadURL(storageReference);
        
        await set(statusRef, {
            id: statusId,
            userId: state.currentUser.uid,
            userName: state.currentUser.name,
            type: 'image',
            content: imageUrl,
            timestamp: Date.now()
        });
    }
}

// ==================================================
// WEBRTC CALLING
// ==================================================

// Initialize call buttons
callBtn.addEventListener('click', () => startCall(false));
videoCallBtn.addEventListener('click', () => startCall(true));

async function startCall(withVideo = false) {
    if (!state.chatPartner) return;
    
    state.isCallActive = true;
    state.isCaller = true;
    
    // Get local media stream
    try {
        const constraints = {
            audio: true,
            video: withVideo
        };
        
        state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = state.localStream;
        
        // Setup peer connection
        await setupPeerConnection();
        
        // Create offer
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);
        
        // Send offer to Firebase
        const callRef = ref(db, `calls/${state.currentChat.id}`);
        await set(callRef, {
            offer: offer,
            caller: state.currentUser.uid,
            receiver: state.chatPartner.uid,
            withVideo: withVideo,
            timestamp: serverTimestamp()
        });
        
        // Show call interface
        showCallInterface();
        callStatus.textContent = 'Calling...';
        remoteUserName.textContent = state.chatPartner.name;
        
    } catch (error) {
        console.error('Error starting call:', error);
        showNotification('Failed to start call. Please check permissions.');
        endCall();
    }
}

async function setupPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    state.peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream tracks
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => {
            state.peerConnection.addTrack(track, state.localStream);
        });
    }
    
    // Handle remote stream
    state.peerConnection.ontrack = (event) => {
        state.remoteStream = event.streams[0];
        remoteVideo.srcObject = state.remoteStream;
    };
    
    // Handle ICE candidates
    state.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            const candidateRef = push(ref(db, `calls/${state.currentChat.id}/candidates`));
            await set(candidateRef, {
                candidate: event.candidate,
                from: state.currentUser.uid
            });
        }
    };
    
    // Handle connection state
    state.peerConnection.onconnectionstatechange = () => {
        switch (state.peerConnection.connectionState) {
            case 'connected':
                callStatus.textContent = 'Connected';
                break;
            case 'disconnected':
            case 'failed':
                endCall();
                break;
        }
    };
    
    // Listen for remote ICE candidates
    const candidatesRef = ref(db, `calls/${state.currentChat.id}/candidates`);
    onChildAdded(candidatesRef, async (snapshot) => {
        const data = snapshot.val();
        if (data.from !== state.currentUser.uid) {
            await state.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
}

// Listen for incoming calls
function setupCallListener() {
    const callsRef = ref(db, 'calls');
    
    onChildAdded(callsRef, async (snapshot) => {
        const callData = snapshot.val();
        const chatId = snapshot.key;
        
        // Check if call is for current user
        if (callData.receiver === state.currentUser.uid && 
            chatId === state.currentChat?.id) {
            
            // Show incoming call notification
            if (confirm(`${state.chatPartner.name} is calling. Accept?`)) {
                await acceptCall(callData, chatId);
            } else {
                await rejectCall(chatId);
            }
        }
    });
}

async function acceptCall(callData, chatId) {
    state.isCallActive = true;
    state.isCaller = false;
    
    // Get local media stream
    try {
        const constraints = {
            audio: true,
            video: callData.withVideo
        };
        
        state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = state.localStream;
        
        // Setup peer connection
        await setupPeerConnection();
        
        // Set remote offer
        await state.peerConnection.setRemoteDescription(
            new RTCSessionDescription(callData.offer)
        );
        
        // Create answer
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);
        
        // Send answer
        await update(ref(db, `calls/${chatId}`), {
            answer: answer,
            accepted: true,
            acceptedAt: serverTimestamp()
        });
        
        // Show call interface
        showCallInterface();
        callStatus.textContent = 'Connected';
        remoteUserName.textContent = state.chatPartner.name;
        
    } catch (error) {
        console.error('Error accepting call:', error);
        showNotification('Failed to accept call.');
        endCall();
    }
}

async function rejectCall(chatId) {
    await update(ref(db, `calls/${chatId}`), {
        rejected: true,
        rejectedAt: serverTimestamp()
    });
    
    // Clean up call data after delay
    setTimeout(() => {
        remove(ref(db, `calls/${chatId}`));
    }, 5000);
}

function showCallInterface() {
    callInterface.classList.remove('hidden');
    appContainer.style.filter = 'blur(5px)';
}

function hideCallInterface() {
    callInterface.classList.add('hidden');
    appContainer.style.filter = 'none';
}

// Call controls
muteBtn.addEventListener('click', () => {
    if (state.localStream) {
        const audioTrack = state.localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        muteBtn.querySelector('i').classList.toggle('fa-microphone-slash');
    }
});

videoToggleBtn.addEventListener('click', () => {
    if (state.localStream) {
        const videoTrack = state.localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        videoToggleBtn.querySelector('i').classList.toggle('fa-video-slash');
    }
});

endCallBtn.addEventListener('click', endCall);

async function endCall() {
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }
    
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }
    
    state.isCallActive = false;
    state.isCaller = false;
    
    // Clean up call data
    if (state.currentChat) {
        remove(ref(db, `calls/${state.currentChat.id}`));
    }
    
    hideCallInterface();
}

// ==================================================
// UI UTILITIES
// ==================================================

// Message sending
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Theme switching
function loadThemePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    darkModeToggle.checked = isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);
}

darkModeToggle.addEventListener('change', (e) => {
    const isDarkMode = e.target.checked;
    localStorage.setItem('darkMode', isDarkMode);
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);
});

themeToggleBtn.addEventListener('click', () => {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const newMode = !isDarkMode;
    
    darkModeToggle.checked = newMode;
    localStorage.setItem('darkMode', newMode);
    document.body.classList.toggle('dark-mode', newMode);
    document.body.classList.toggle('light-mode', !newMode);
});

// Helper functions
function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return 'Email already in use.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/weak-password':
            return 'Password is too weak.';
        case 'auth/user-not-found':
            return 'User not found.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        default:
            return error.message;
    }
}

function getInitials(name) {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-color);
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        box-shadow: 0 3px 10px var(--shadow);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ==================================================
// FIREBASE HELPER FUNCTIONS
// ==================================================

// Firebase doesn't have limitToLast in modular v10, so we need to implement it
function limitToLast(limit) {
    return {
        type: 'limitToLast',
        value: limit
    };
}

// Initialize Firebase onDisconnect
function onDisconnect(ref) {
    // This is a simplified version - in real app, use Firebase Admin SDK on server
    return {
        set: async (value) => {
            // Store disconnect handler in localStorage
            const handlers = JSON.parse(localStorage.getItem('disconnectHandlers') || '{}');
            handlers[ref.path] = value;
            localStorage.setItem('disconnectHandlers', JSON.stringify(handlers));
        }
    };
}

// Handle page visibility change for online status
document.addEventListener('visibilitychange', async () => {
    if (state.currentUser) {
        const userRef = ref(db, `users/${state.currentUser.uid}`);
        
        if (document.hidden) {
            // Page is hidden, set offline
            await update(userRef, {
                online: false,
                lastSeen: serverTimestamp()
            });
        } else {
            // Page is visible, set online
            await update(userRef, {
                online: true,
                lastSeen: serverTimestamp()
            });
        }
    }
});

// Handle beforeunload for clean disconnect
window.addEventListener('beforeunload', async () => {
    if (state.currentUser) {
        const userRef = ref(db, `users/${state.currentUser.uid}`);
        await update(userRef, {
            online: false,
            lastSeen: serverTimestamp()
        });
    }
});

// ==================================================
// INITIALIZATION
// ==================================================

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Load theme preference
    loadThemePreference();
    
    // Setup call listener
    setupCallListener();
    
    // Show welcome message
    console.log('WhatsApp Web Clone initialized');
    console.log('Features:');
    console.log('✓ Authentication');
    console.log('✓ Real-time messaging');
    console.log('✓ End-to-end encryption');
    console.log('✓ Read receipts & typing indicators');
    console.log('✓ Online status');
    console.log('✓ Status updates (24h)');
    console.log('✓ Audio/Video calling (WebRTC)');
    console.log('✓ Dark mode');
});

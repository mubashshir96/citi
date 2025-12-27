{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "chats": {
      "$chatId": {
        ".read": "auth != null && ($chatId.contains(auth.uid))",
        ".write": "auth != null && ($chatId.contains(auth.uid))",
        "messages": {
          ".indexOn": ["timestamp"]
        }
      }
    },
    "typing": {
      "$chatId": {
        ".read": "auth != null && ($chatId.contains(auth.uid))",
        ".write": "auth != null && ($chatId.contains(auth.uid))"
      }
    },
    "calls": {
      "$chatId": {
        ".read": "auth != null && ($chatId.contains(auth.uid))",
        ".write": "auth != null && ($chatId.contains(auth.uid))"
      }
    },
    "statuses": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["timestamp"]
    }
  }
}

// firebase-config.js

// Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get a reference to the storage service
const storage = firebase.storage();
const firestore = firebase.firestore();

// Function to upload a file to Firebase Storage
async function uploadFile(file, userId, category) {
  try {
    const fileRef = storage.ref().child(`${userId}/${category}/${file.name}`);
    const snapshot = await fileRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();
    
    // Save metadata in Firestore
    await firestore.collection('files').add({
      userId: userId,
      category: category,
      filename: file.name,
      downloadURL: downloadURL,
      uploadDate: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return downloadURL;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

// Function to get all files for a user by category
async function getUserFiles(userId, category) {
  try {
    const filesSnapshot = await firestore.collection('files')
      .where('userId', '==', userId)
      .where('category', '==', category)
      .get();
    
    const files = [];
    filesSnapshot.forEach(doc => {
      files.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return files;
  } catch (error) {
    console.error("Error getting user files:", error);
    throw error;
  }
}

// Function to delete a file
async function deleteFile(fileId, userId) {
  try {
    // Get the file document first to get the storage path
    const fileDoc = await firestore.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      throw new Error("File not found");
    }
    
    const fileData = fileDoc.data();
    
    if (fileData.userId !== userId) {
      throw new Error("Unauthorized to delete this file");
    }
    
    // Delete from Storage
    const fileRef = storage.refFromURL(fileData.downloadURL);
    await fileRef.delete();
    
    // Delete from Firestore
    await firestore.collection('files').doc(fileId).delete();
    
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}

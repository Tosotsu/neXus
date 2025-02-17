
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

const multer = require('multer');

const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const express = require('express');
const cors = require('cors');
const connectDB = require('./db/config');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
//connectDB();

// MongoDB Connection with better error handling
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
    w: 'majority'
})
.then(() => {
    console.log('Successfully connected to MongoDB Atlas');
})
.catch((error) => {
    console.error('Error connecting to MongoDB Atlas:', error.message);
    if (error.name === 'MongoServerSelectionError') {
        console.error('Could not connect to MongoDB server. Please check:');
        console.error('1. Your network connection');
        console.error('2. MongoDB Atlas status');
        console.error('3. Whether your IP is whitelisted in MongoDB Atlas');
    }
    if (error.name === 'MongoServerError' && error.code === 18) {
        console.error('Authentication failed. Please check:');
        console.error('1. Username and password in your connection string');
        console.error('2. Database user permissions in MongoDB Atlas');
    }
    process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Models
const User = require('./models/User');
const Profile = require('./models/Profile');
const Document = require('./models/Document');
const EmergencyContact = require('./models/EmergencyContact');
const MedicalReport = require('./models/MedicalReport');

// Authentication Routes


  
app.post('/api/register', async (req, res) => {
    try {
        const { username, phone, email, password } = req.body;
        
        // Check if user already exists
        const userExists = await User.findOne({ $or: [{ username }, { email }, { phone }] });
        
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new user
        const user = new User({
            username,
            email,
            phone,
            password: hashedPassword
        });
        
        await user.save();
        
        // Create empty profile
        const profile = new Profile({
            user: user._id,
            name: username,
            age: null,
            gender: null,
            bloodType: null,
            location: null
        });
        
        await profile.save();
        
        // Generate OTP (in a real application, you'd send this via SMS/email)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in user document (in a real app, store with expiry)
        user.otp = otp;
        await user.save();
        
        res.status(201).json({ message: 'User registered successfully', otp });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        const user = await User.findOne({ phone });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        
        // Clear OTP after successful verification
        user.otp = null;
        user.isVerified = true;
        await user.save();
        
        // Generate JWT
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.status(200).json({
            message: 'OTP verified successfully',
            token,
            userId: user._id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Special case for admin
        if (username === 'admin') {
            return res.status(200).json({ isAdmin: true });
        }
        
        // Check if user is verified
        if (!user.isVerified) {
            return res.status(401).json({ message: 'Account not verified' });
        }
        
        // Generate JWT
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.status(200).json({
            message: 'Login successful',
            token,
            userId: user._id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Middleware to verify JWT
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Profile Routes
app.get('/api/profile', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id });
        
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        res.status(200).json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/profile', auth, async (req, res) => {
    try {
        const { name, age, gender, bloodType, location } = req.body;
        
        const profile = await Profile.findOne({ user: req.user._id });
        
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        profile.name = name || profile.name;
        profile.age = age || profile.age;
        profile.gender = gender || profile.gender;
        profile.bloodType = bloodType || profile.bloodType;
        profile.location = location || profile.location;
        
        await profile.save();
        
        res.status(200).json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/profile/picture', auth, upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const profile = await Profile.findOne({ user: req.user._id });
        
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        profile.profilePic = `/uploads/${req.file.filename}`;
        await profile.save();
        
        res.status(200).json({ profilePic: profile.profilePic });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Emergency Contacts Routes
app.get('/api/emergency-contacts', auth, async (req, res) => {
    try {
        const contacts = await EmergencyContact.find({ user: req.user._id });
        res.status(200).json(contacts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/emergency-contacts', auth, async (req, res) => {
    try {
        const { name, number } = req.body;
        
        const contact = new EmergencyContact({
            user: req.user._id,
            name,
            number
        });
        
        await contact.save();
        
        res.status(201).json(contact);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/emergency-contacts/:id', auth, async (req, res) => {
    try {
        const contact = await EmergencyContact.findById(req.params.id);
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        // Check user
        if (contact.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'User not authorized' });
        }
        
        await contact.remove();
        
        res.status(200).json({ message: 'Contact removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Document Routes
app.get('/api/documents', auth, async (req, res) => {
    try {
        const documents = await Document.find({ user: req.user._id });
        res.status(200).json(documents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/documents', auth, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const { title, description } = req.body;
        
        const document = new Document({
            user: req.user._id,
            title,
            description,
            filePath: `/uploads/${req.file.filename}`
        });
        
        await document.save();
        
        res.status(201).json(document);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/documents/:id', auth, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }
        
        // Check user
        if (document.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'User not authorized' });
        }
        
        await document.remove();
        
        res.status(200).json({ message: 'Document removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Medical Reports Routes
app.get('/api/medical-reports', auth, async (req, res) => {
    try {
        const reports = await MedicalReport.find({ user: req.user._id });
        res.status(200).json(reports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/medical-reports', auth, upload.single('report'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const { title, date, doctor, diagnosis } = req.body;
        
        const report = new MedicalReport({
            user: req.user._id,
            title,
            date,
            doctor,
            diagnosis,
            filePath: `/uploads/${req.file.filename}`
        });
        
        await report.save();
        
        res.status(201).json(report);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// QR Code Generation
app.get('/api/generate-qr', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user._id });
        
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        // Create public profile URL
        const profileUrl = `${process.env.FRONTEND_URL}/public-profile.html?id=${profile._id}`;
        
        // Generate QR code
        const qrCodeDataUrl = await QRCode.toDataURL(profileUrl);
        
        res.status(200).json({ qrCode: qrCodeDataUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Public Profile Endpoint (no auth needed)
app.get('/api/public-profile/:id', async (req, res) => {
    try {
        const profile = await Profile.findById(req.params.id);
        
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        
        // Get emergency contacts for this profile
        const emergencyContacts = await EmergencyContact.find({ user: profile.user });
        
        // Create a sanitized public profile (excluding sensitive info)
        const publicProfile = {
            name: profile.name,
            age: profile.age,
            gender: profile.gender,
            bloodType: profile.bloodType,
            emergencyContacts
        };
        
        res.status(200).json(publicProfile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Route to serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('client/build'));
    
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    });
}


// Serve static files (login.html and register.html are in the same directory)
app.use(express.static(__dirname));

// Serve login.html when user visits root ('/')
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve register.html when requested
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

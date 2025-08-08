const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const userModel = require("./models/user");
const postModel = require("./models/post");
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const upload = require("./config/multerconfig");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());



app.get('/', (req, res) => {
    res.render("index");
});

app.get("/profile/upload", (req, res) => {
    res.render("profileupload");
});

app.post("/upload", isLoggedIn, upload.single("image"), async (req, res) => {
let user = await userModel.findOne({email: req.user.email})
user.profilepic = req.file.filename;
await user.save();
res.redirect("/profile");
});


app.get('/login', (req, res) => {
    res.render("login");
});



// Change profile picture page
app.get('/profile/change', isLoggedIn, (req, res) => {
    res.render("profileupload");
});

app.get('/profile/remove', isLoggedIn, async (req, res) => {
    let user = await userModel.findById(req.user.userid);
    user.profilepic = "profile.jpg"; // default image ka naam
    await user.save();
    res.redirect("/profile");
});

// Apna profile (owner)
app.get('/profile', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email }).populate("posts");
    res.render("profile", { user, isOwner: true });
});


// Kisi ka bhi profile (by ID)
app.get('/profile/:id', isLoggedIn, async (req, res) => {
    let profileUser = await userModel.findById(req.params.id).populate("posts");
    let isOwner = req.user.userid === profileUser._id.toString();
    res.render("profile", { user: profileUser, isOwner });
});





app.post('/like/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id });

    let liked = false;
    if (post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid);
        liked = true;
    } else {
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }
    await post.save();

    res.json({ liked, likes: post.likes.length });
});



app.get('/edit/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id });

   res.render("edit", {post})
});
app.post('/update/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({ _id: req.params.id}, {content: req.body.content}).populate("user");

   res.redirect("/profile")
});


app.post('/post', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email });
    let { content } = req.body;

    let post = await postModel.create({
        user: user._id,
        content
    });
    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");
});

app.get('/delete/:id', isLoggedIn, async (req, res) => {
    // Post delete
    await postModel.findOneAndDelete({ _id: req.params.id, user: req.user.userid });

    // User ke posts array se bhi delete karo
    await userModel.findOneAndUpdate(
        { _id: req.user.userid },
        { $pull: { posts: req.params.id } }
    );

    res.redirect('/profile');
});


app.post('/register', async (req, res) => {
    let { email, password, username, name, age } = req.body;
    let user = await userModel.findOne({ email });
    if (user) return res.status(500).send("User already registered");

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                username,
                email,
                age,
                name,
                password: hash
            });

            let token = jwt.sign({ email: email, userid: user._id }, "Mjjjj");
            res.cookie("token", token);
            res.send("registered");
        });
    })
});

app.post('/login', async (req, res) => {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (!user) return res.status(500).send("Something went wrong");

    bcrypt.compare(password, user.password, function (err, result) {
        if (result) {
            let token = jwt.sign({ email: email, userid: user._id }, "Mjjjj");
            res.cookie("token", token);
            res.status(200).redirect("/profile");
        }

        else res.redirect("/login");
    })

});

app.get('/logout', (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});

function isLoggedIn(req, res, next) {
    if (req.cookies.token === "") res.redirect("/login");
    else {
        let data = jwt.verify(req.cookies.token, "Mjjjj");
        req.user = data;
        next();
    }
}

app.listen(3000);
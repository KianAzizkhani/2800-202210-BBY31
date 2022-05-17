const express = require("express");
const path = require('path');
const session = require('express-session');
const User = require("./models/BBY_31_users");
const Chat = require("./models/BBY_31_messages");
const Cart = require("./models/BBY_31_shoppingCarts");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require('bcrypt');
const port = process.env.PORT || 8000;
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);


//Creates connection between server and client
io.on('connection', (socket) => {
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    socket.on("chat message", function (msg) {

        //broadcast message to everyone in port:8000 except yourself.
        socket.broadcast.emit("received", { message: msg });

        //save chat to the database
        let connect = mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        connect.then(db => {
            let chatMessage = new Chat({
                message: msg,
                sender: "Anonymous"
            });

            chatMessage.save();
        });
    });
});

app.set('view engine', 'text/html');

if (process.env.NODE_ENV != 'production') {
    require('dotenv').config()
}
mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log("connected to db"))
    .catch((err) => console.log(err));

app.use(express.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: "password",
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 10800000
    }
}));

//Custom middleware functions
function isLoggedIn(req, res, next) {
    if (req.session.isLoggedIn) {
        return next();
    } else {
        return res.redirect('/login');
    }
}

function isLoggedOut(req, res, next) {
    if (!req.session.isLoggedIn) {
        return next();
    } else {
        return res.redirect('/userprofile');
    }
}

function isAdmin(req, res, next) {
    let userId = req.session.user._id;
    User.findById({
        _id: userId
    }, function (err, user) {
        if (err) console.log(err)
        else if (!user) {
            return res.redirect('/login')
        }
        if (user.userType == 'admin') {
            return next();
        }
        else {
            return res.redirect('/userprofile');
        }
    })
}

function setHeaders(req, res, next) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
    res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
    res.setHeader("Expires", "0"); // Proxies.
    return next();
}

async function hasRecentlyPurchased(req, res, next){
    //If a purchase was made in the last 3 mins, render thank-you page
    var currentTime = new Date();
    var nowMinus3Mins = new Date(currentTime.getTime() - 3 * 60000);

    var recentOrderExists = await Cart.exists({
        userId: req.session.user._id,
        status: "completed",
        purchased: {
            $gt: nowMinus3Mins
        }
    })

    if (recentOrderExists){
        return next();
    } else {
        return res.redirect('/');
    }
}

function isPatient(req, res, next){
    if (req.session.user.userType == 'patient'){
        return next();
    }
    return res.redirect('/');
}

//Routes

//user profile page multer to update/change/fetch profile images
var profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + file.originalname);
    }
})

var profileUpload = multer({
    storage: profileStorage
})

app.post('/uploadProfile', profileUpload.single('profileFile'), (req, res) => {
    if (req.file) {
        var fileName = req.file.filename;
        var id = req.session.user._id;
        User.updateOne({
            "_id": id
        }, {
            profileImg: "../uploads/" + fileName
        }).then((obj) => {
            console.log('Updated - ' + obj);
        })
    } else {
        return;
    }
});

app.get('/getProfilePicture', (req, res) => {
    var id = req.session.user._id;
    User.findById({
        _id: id
    }, function (err, user) {
        if (user) {
            res.send(user)
        }
    })
})

app.get('/isLoggedIn', (req, res) => {
    res.send(req.session.user);
})

app.get('/', function (req, res) {
    res.sendFile(path.resolve('public/index.html'));
});

app.get('/therapists', function (req, res) {
    res.sendFile(path.resolve('public/therapists.html'));
});

app.get('/checkout', isLoggedIn, isPatient, function (req, res) {
    res.sendFile(path.resolve('public/checkout.html'));
});

app.get('/order-history', isLoggedIn, isPatient, function (req, res) {
    res.sendFile(path.resolve('public/order-history.html'));
});

app.get('/thank-you', isLoggedIn, hasRecentlyPurchased, function (req, res) {
    res.sendFile(path.resolve('public/thank-you.html'));
});

app.get("/login", isLoggedOut, setHeaders, (req, res) => {
    res.sendFile(path.resolve('public/login.html'));
});

app.get('/admin-dashboard', isLoggedIn, isAdmin, setHeaders, (req, res) => {
    res.sendFile(path.resolve('public/admin-dashboard.html'))
});

app.get('/chat-session', isLoggedIn, setHeaders, (req, res) => {
    res.sendFile(path.resolve('public/chat-session.html'))
});

app.get('/getUserInfo', isLoggedIn, setHeaders, (req, res) => {
    let userId = req.session.user._id;
    User.findById({
        _id: userId
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            res.json(user);
        }
    })
})

app.get('/getTherapists', (req, res) => {
    User.find({
        userType: "therapist"
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            res.json(user);
        }
    }).sort({
        numSessions: 'desc'
    })
})

app.post('/login', async (req, res) => {
    User.findOne({
        email: req.body.email.toLowerCase()
    }, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect('/login');
        }
        if (!user) {
            res.json("NoEmailExist");
            console.log('No user with such email.');
        } else {
            return auth(req, res, user);
        }
    });
})

function auth(req, res, user) {
    bcrypt.compare(req.body.password, user.password, function (err, comp) {
        if (err) {
            console.log(err);
            res.redirect('/login');
        } else if (comp === false) {
            console.log("Wrong password");
            res.json("wrongPassword");
        } else {
            req.session.user = user;
            req.session.isLoggedIn = true;
            res.json(user);
        }
    })
}

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log('Error removing user session data. ', err);
    });
    res.redirect('/login')
})

app.get('/userprofile', isLoggedIn, setHeaders, (req, res) => {
    res.sendFile(path.resolve('public/userprofile.html'))
})

app.get('/edit-account', isLoggedIn, setHeaders, (req, res) => {
    res.sendFile(path.resolve('public/edit-account.html'))
})

app.get("/sign-up", isLoggedOut, setHeaders, (req, res) => {
    res.sendFile(path.resolve('public/sign-up.html'))
})

app.post('/editProfile', isLoggedIn, isNotExisting, async (req, res) => {
    let hashedPassword;
    var pass = req.session.user.password;
    var newpass;
    if (req.body.password == "") {
        newpass = pass;
    } else {
        hashedPassword = await bcrypt.hash(req.body.password, 10);
        newpass = hashedPassword;
    }

    User.updateOne({
        "_id": req.session.user._id
    }, {
        "firstName": req.body.firstname,
        "lastName": req.body.lastname,
        "username": req.body.username,
        "email": req.body.email,
        "phoneNum": req.body.phone,
        "password": newpass,
        "yearsExperience": req.body.yearsExperience,
        "sessionCost": req.body.sessionCost
    })
        .then((obj) => {
            return res.json("updated");
        })
        .catch((err) => {
            console.log('Error: ' + err);
        })
})

async function isNotExisting(req, res, next) {
    var emailExists = await User.exists({
        email: req.body.email
    })
    var phoneExists = await User.exists({
        phoneNum: req.body.phone
    })
    var usernameExists = await User.exists({
        username: req.body.username
    })

    let userId = req.session.user._id;
    User.findById({
        _id: userId
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            if (emailExists && req.body.email != user.email) {
                return res.json("existingEmail");
            } else if (phoneExists && req.body.phone != user.phoneNum) {
                return res.json("existingPhone")
            } else if (usernameExists && req.body.username != user.username) {
                return res.json("existingUsername")
            } else {
                return next();
            }
        } else {
            req.session.destroy();
            return res.json("logout");
        }
    })
}

app.post("/sign-up", isNotRegistered, async (req, res) => {
    let userType = (req.body.userType != 'patient' && req.body.userType != 'therapist') ? 'patient' : req.body.userType;
    if (req.body.userType == "therapist") {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: userType,
                yearsExperience: req.body.yearsExperience,
                sessionCost: req.body.sessionCost,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    } else {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: userType,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    }
})

async function isNotRegistered(req, res, next) {
    var emailExists = await User.exists({
        email: req.body.email
    })
    var phoneExists = await User.exists({
        phoneNum: req.body.phone
    })
    var usernameExists = await User.exists({
        username: req.body.username
    })
    if (emailExists) {
        return res.json("existingEmail");
    } else if (phoneExists) {
        return res.json("existingPhone")
    } else if (usernameExists) {
        return res.json("existingUsername")
    } else {
        return next();
    }
}

//////Admin Dashboard////////

//MiddleWare

function isNotLastAdminDelete(req, res, next) {
    if (req.body.previousUserType == 'admin') {
        User.count({
            userType: 'admin'
        }, (err, count) => {
            if (err) {
                console.log("Error while checking if user is last admin in db. ", err);
            } else if (count > 1) {
                return next();
            } else {
                return res.send('lastAdmin');
            }
        })
    } else {
        return next();
    }
}

function isNotLastAdminEdit(req, res, next) {
    if (req.body.previousUserType == 'admin' && req.body.userType != 'admin') {
        User.count({
            userType: 'admin'
        }, (err, count) => {
            if (err) {
                console.log("Error while checking if user is last admin in db. ", err);
            } else if (count > 1) {
                return next();
            } else {
                return res.send('lastAdmin');
            }
        })
    } else {
        return next();
    }
}

//Routes

app.get('/getAllUsersData', isLoggedIn, isAdmin, setHeaders, (req, res) => {
    User.find({}, function (err, user) {
        if (err) {
            console.log('Error searching user.', err);
        }
        if (!user) {
            console.log('Database is empty.');
        }
        res.json(user);
    });
})

app.delete('/deleteUser', isLoggedIn, isAdmin, isNotLastAdminDelete, async (req, res) => {
    User.deleteOne({
        _id: req.body.id
    })
        .then(function () {
            //if user is deleting themselves, delete session data
            if (req.body.id == req.session.user._id) {
                req.session.destroy();
            }
            res.send();
        }).catch(function (error) {
            console.log(error); // Failure
        });
})

app.delete('/deleteUserProfile', isLoggedIn, isNotLastAdminDelete, async (req, res) => {
    User.deleteOne({
        _id: req.session.user._id
    })
        .then(function () {
            req.session.destroy();
            res.send();
        }).catch(function (error) {
            console.log(error); // Failure
        });
})

async function isNotExistingAdmin(req, res, next) {
    var emailExists = await User.exists({
        email: req.body.email
    })
    var phoneExists = await User.exists({
        phoneNum: req.body.phone
    })
    var usernameExists = await User.exists({
        username: req.body.username
    })

    let userId = req.body.id;
    User.findById({
        _id: userId
    }, function (err, user) {
        if (err) console.log(err)
        if (user) {
            if (emailExists && req.body.email != user.email) {
                return res.send("existingEmail");
            } else if (phoneExists && req.body.phone != user.phoneNum) {
                return res.send("existingPhone")
            } else if (usernameExists && req.body.username != user.username) {
                return res.send("existingUsername")
            } else {
                return next();
            }
        } else {
            res.send("unexistingUser")
        }
    })
}

app.put('/editUser', isLoggedIn, isAdmin, isNotExistingAdmin, isNotLastAdminEdit, (req, res) => {
    if (req.body.password != "") {
        return updateUserWithPassword(req, res);
    }
    if (req.body.userType == "therapist") {
        User.updateOne({
            "_id": req.body.id
        }, {
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType,
            "yearsExperience": req.body.yearsExperience,
            "sessionCost": req.body.sessionCost
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithoutPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    } else {
        User.updateOne({
            "_id": req.body.id
        }, {
            $unset: {
                "yearsExperience": "",
                "sessionCost": ""
            },
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithoutPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    }
})

async function updateUserWithPassword(req, res) {
    var hashedPassword = await bcrypt.hash(req.body.password, 10);
    if (req.body.userType == "therapist") {
        User.updateOne({
            "_id": req.body.id
        }, {
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType,
            "yearsExperience": req.body.yearsExperience,
            "sessionCost": req.body.sessionCost,
            "password": hashedPassword
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    } else {
        User.updateOne({
            "_id": req.body.id
        }, {
            $unset: {
                "yearsExperience": "",
                "sessionCost": ""
            },
            "firstName": req.body.firstname,
            "lastName": req.body.lastname,
            "username": req.body.username,
            "email": req.body.email,
            "phoneNum": req.body.phone,
            "userType": req.body.userType,
            "password": hashedPassword
        })
            .then((obj) => {
                if (req.session.user._id == req.body.id && req.body.userType != req.session.user.userType)
                    req.session.destroy();
                return res.send("updatedWithPassword");
            })
            .catch((err) => {
                console.log('Error: ' + err);
            })
    }
}

app.post("/createUser", isLoggedIn, isAdmin, isNotRegistered, async (req, res) => {
    if (req.body.userType == "therapist") {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: req.body.userType,
                yearsExperience: req.body.yearsExperience,
                sessionCost: req.body.sessionCost,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    } else {
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const new_user = new User({
                firstName: req.body.firstname,
                lastName: req.body.lastname,
                username: req.body.username,
                phoneNum: req.body.phone,
                userType: req.body.userType,
                email: req.body.email,
                password: hashedPassword
            });

            new_user.save()
                .then((result) => {
                    console.log(result);
                    res.json("login");
                });
        } catch (err) {
            console.log("Error while checking if user was already registered. ", err);
            res.redirect('/sign-up');
        }
    }
})

//Checkout

app.post('/addToCart', isLoggedIn, async (req, res) => {
    //Check if there is already something in cart
    var cartExists = await Cart.exists({
        userId: req.session.user._id,
        status: "active"
    })
    if (cartExists) {
        return res.send("cartExists");
    }

    //Check if user has a current valid session with another therapist
    var currentTime = new Date();
    var orderExists = await Cart.exists({
        userId: req.session.user._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    })
    if (orderExists) {
        console.log("Something exists")
        return res.send("orderExists");
    }

    const new_cart = new Cart({
        orderId: "MM" + Math.floor((Math.random() * 1500000000) + 1000000000),
        therapist: req.body.therapist,
        userId: req.session.user._id,
        status: "active"
    });

    new_cart.save()
        .then((result) => {
            console.log(result);
        });

    res.send();

})

app.get('/checkStatus', isLoggedIn, (req, res) => {
    Cart.findOne({
        userId: req.session.user._id,
        status: "active"
    }, function (err, cart) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (!cart) {
            res.send();
        } else {
            res.json(cart);
        }
    });
})

app.post('/getTherapistInfo', isLoggedIn, (req, res) => {
    var therapistInfo;
    User.findById({
        _id: req.body.therapistId
    }, function (err, user) {
        if (err) console.log(err)

        if (!user) {
            return res.redirect('/')
        }
        else {
            therapistInfo = {
                firstName: user.firstName,
                lastName: user.lastName,
                yearsExperience: user.yearsExperience,
                sessionCost: user.sessionCost,
                profileImg: user.profileImg
            }
            res.json(therapistInfo);
        }
    })
})

app.delete('/deleteCart', isLoggedIn, async (req, res) => {
    Cart.updateOne({
        userId: req.session.user._id,
        status: "active"
    }, {
        status: "deleted"
    }).then((obj) => {
        console.log("deleted");
        res.send()
    }).catch(function (error) {
        console.log(error);
    })
})


app.post('/confirmCart', isLoggedIn, async (req, res) => {
    if (req.body.cartPlan == "freePlan") {
        var trialStatus = await User.exists({
            _id: req.session.user._id,
            usedTrial: true
        })
    }
    if (trialStatus) {
        return res.send("usedTrial");
    }

    const currentDate = Date.now();
    Cart.updateOne({
        userId: req.session.user._id,
        status: "active"
    }, {
        status: "completed",
        $set: {
            purchased: currentDate,
            expiringTime: req.body.timeLengthforUse,
            cost: req.body.totalPrice
        }
    }).then((obj) => {
        console.log("Completed");
        return res.send(obj);
    }).catch(function (error) {
        console.log(error);
    })
    User.updateOne({
        _id: req.session.user._id
    }, {
        usedTrial: true
    }).then((obj) => {
        console.log("User used their free trial!");
    }).catch(function (error) {
        console.log(error);
    })
    incrementTherapistSessionNum(req.session.user._id);
})

function incrementTherapistSessionNum(userID) {
    Cart.find({
        userId: userID,
        status: "completed"
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            const sortedCart = carts.sort((a, b) => b.purchased - a.purchased)
            var therapistID = sortedCart[0].therapist
            User.updateOne({
                _id: therapistID
            }, {
                $inc: {
                    numSessions: 1
                }
            }).then((obj) => {
                console.log(obj)
            }).catch(function (error) {
                console.log(error);
            })
        }
    });
}

app.put('/updateCart', isLoggedIn, async (req, res) => {
    Cart.updateOne({
        userId: req.session.user._id,
        status: "active"
    }, {
        timeLength: req.body.timeLength
    }).then((obj) => {
        res.send(obj)
    }).catch(function (error) {
        console.log(error);
    })
})

app.get('/getPreviousPurchases', isLoggedIn, (req, res) => {
    Cart.find({
        userId: req.session.user._id,
        $or: [{
            status: "completed",
        }, {
            status: "refunded",
        }]
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            res.json(carts);
        }
    });
})

app.get('/recentPurchase', isLoggedIn, (req, res) => {
    Cart.find({
        userId: req.session.user._id,
        status: "completed"
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts) {
            const sortedCart = carts.sort((a, b) => b.purchased - a.purchased)
            return res.json(sortedCart[0])
        }
    });
})

app.get('/activeSession', isLoggedIn, (req, res) => {
    var currentTime = new Date();
    Cart.find({
        userId: req.session.user._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    }, function (err, carts) {
        if (err) {
            console.log('Error searching cart.', err);
        }
        if (carts.length > 0) {
            console.log(carts)
            const sortedCart = carts.sort((a, b) => b.purchased - a.purchased);
            var therapistName;
            var errorMessageVariables;
            User.findOne({
                _id: sortedCart[0].therapist
            }, function (err, user) {
                if (err) console.log(err)
                if (user) {
                    therapistName = user.firstName + " " + user.lastName
                    errorMessageVariables = {
                        cost: sortedCart[0].cost,
                        purchased: sortedCart[0].expiringTime,
                        therapistName: therapistName
                    };
                    return res.json(errorMessageVariables)
                }
            })
        } else {
            return res.json("NoActiveSession");
        }
    })
})

app.post('/refundOrder', isLoggedIn, (req, res) => {
    var currentTime = new Date();
    Cart.updateOne({
        userId: req.session.user._id,
        status: "completed",
        expiringTime: {
            $gt: currentTime
        }
    }, {
        expiringTime: currentTime,
        status: "refunded"
    }).then((obj) => {
        res.send(obj)
    }).catch(function (error) {
        console.log(error);
    })
})

server.listen(8000, () => {
    console.log('listening on port:8000');
});

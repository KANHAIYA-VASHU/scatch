
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const {generateToken} = require("../utils/generateToken");
const userModel = require("../models/user-model");

module.exports.registerUser = async function(req, res){
    try{
        let { email, password, fullname } = req.body;

        let user = await userModel.findOne({email:email});

        if(user) {
            req.flash("error", "You already have an account, please login.");
            return res.redirect("/");
        }
        
        const salt = await bcrypt.genSalt(10);
        
        bcrypt.hash(password, salt, async function(err, hash){
            if(err) return res.send(err.message);
            else{
                let user = await userModel.create({
                email,
                password : hash,
                fullname,
            });
            let token = generateToken(user, "user");
            res.cookie("token", token);
            res.cookie("ownerToken", "");
            req.flash("success", "Account created successfully.");
            res.redirect("/shop");
            }
        });


        
    }catch(err){
        req.flash("error", err.message);
        res.redirect("/");
    }
    
};

module.exports.loginUser = async function(req, res){
    let { email, password } = req.body;

    let user = await userModel.findOne ({ email: email});
    if(!user) {
        req.flash("error", "Email or password is incorrect.");
        return res.redirect("/");
    }

    bcrypt.compare(password, user.password, function(err, result){
        if(result){
            let token = generateToken(user, "user");
            res.cookie("token", token);
            res.cookie("ownerToken", "");
            req.flash("success", "Welcome back.");
            res.redirect("/shop");
        }
        else{
            req.flash("error", "Email or password is incorrect.");
            return res.redirect("/");
        }
    })
}

module.exports.logout = function(req, res) {
    res.cookie("token", "");
    res.cookie("ownerToken", "");
    res.redirect("/");
};

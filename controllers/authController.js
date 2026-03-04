
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const {generateToken} = require("../utils/generateToken");
const { hashPassword, verifyAndUpgradePassword } = require("../utils/password");
const userModel = require("../models/user-model");

module.exports.registerUser = async function(req, res){
    try{
        let { email, password, fullname } = req.body;

        let existingUser = await userModel.findOne({email:email});

        if(existingUser) {
            req.flash("error", "You already have an account, please login.");
            return res.redirect("/");
        }

        const hashedPassword = await hashPassword(password);
        let user = await userModel.create({
            email,
            password: hashedPassword,
            fullname,
        });

        let token = generateToken(user, "user");
        res.cookie("token", token);
        res.cookie("ownerToken", "");
        req.flash("success", "Account created successfully.");
        res.redirect("/shop");


        
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

    const { ok } = await verifyAndUpgradePassword(user, password);
    if (!ok) {
        req.flash("error", "Email or password is incorrect.");
        return res.redirect("/");
    }

    let token = generateToken(user, "user");
    res.cookie("token", token);
    res.cookie("ownerToken", "");
    req.flash("success", "Welcome back.");
    res.redirect("/shop");
}

module.exports.logout = function(req, res) {
    res.cookie("token", "");
    res.cookie("ownerToken", "");
    res.redirect("/");
};

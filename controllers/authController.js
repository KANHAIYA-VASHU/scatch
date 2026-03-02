
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const {generateToken} = require("../utils/generateToken");
const userModel = require("../models/user-model");

module.exports.registerUser = async function(req, res){
    try{
        let { email, password, fullname } = req.body;

        let user = await userModel.findOne({email:email});

        if(user) return res.status(401).send("You already have an account, Please login.");
        
        const salt = await bcrypt.genSalt(10);
        
        bcrypt.hash(password, salt, async function(err, hash){
            if(err) return res.send(err.message);
            else{
                let user = await userModel.create({
                email,
                password : hash,
                fullname,
            });
            let token = generateToken(user);
            res.cookie("token", token);
            res.send("user created successfully");
            }
        });


        
    }catch(err){
        res.send(err.message);
    }
    
};

module.exports.loginUser = async function(req, res){
    let { email, password } = req.body;

    let user = await userModel.findOne ({ email: email});
    if(!user) return res.send("Email or Password is incorrect");

    bcrypt.compare(password, user.password, function(err, result){
        if(result){
            let token = generateToken(user);
            res.cookie("token", token);
            res.send("you can login");
        }
        else{
            return res.send("Email or Password incorrect");
        }
    })
}

module.exports.logout = function(req, res) {
    res.cookie("token", "");
    res.redirect("/");
};
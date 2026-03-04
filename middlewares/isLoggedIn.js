const jwt = require("jsonwebtoken");

const userModel = require("../models/user-model");

module.exports = async function(req, res, next){
    if (req.cookies.ownerToken) {
        req.flash("error", "Owner session active. Please use owner dashboard.");
        return res.redirect("/owners/admin");
    }

    if(!req.cookies.token){
        req.flash("error", "you need to login first");
        return res.redirect("/");
    }

    try {
        let decoded = jwt.verify(req.cookies.token, process.env.JWT_KEY);
        if (decoded.role && decoded.role !== "user") {
            req.flash("error", "User access only.");
            return res.redirect("/owners/admin");
        }

        let user = await userModel
            .findOne({ email: decoded.email })
            .select("-password");

        if (!user) {
            req.flash("error", "Invalid user session. Please login again.");
            return res.redirect("/users/logout");
        }

        req.user = user;
        req.role = "user";
        next();
    }
    catch(err){
        req.flash("error", "something went wrong.");
        res.redirect("/")
    }
};

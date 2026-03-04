const jwt = require("jsonwebtoken");
const ownerModel = require("../models/owner-model");

module.exports = async function(req, res, next) {
    if (req.cookies.token) {
        req.flash("error", "User session active. Please use user pages.");
        return res.redirect("/shop");
    }

    if (!req.cookies.ownerToken) {
        req.flash("error", "Owner login required.");
        return res.redirect("/owners/login");
    }

    try {
        const decoded = jwt.verify(req.cookies.ownerToken, process.env.JWT_KEY);
        if (decoded.role !== "owner") {
            req.flash("error", "Owner access only.");
            return res.redirect("/");
        }

        const owner = await ownerModel.findOne({ email: decoded.email }).select("-password");
        if (!owner) {
            req.flash("error", "Invalid owner session. Please login again.");
            res.cookie("ownerToken", "");
            return res.redirect("/owners/login");
        }

        req.owner = owner;
        req.role = "owner";
        next();
    } catch (err) {
        req.flash("error", "Something went wrong.");
        res.cookie("ownerToken", "");
        res.redirect("/owners/login");
    }
};

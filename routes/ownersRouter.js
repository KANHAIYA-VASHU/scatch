const express = require("express");
const router = express.Router();
const ownerModel = require("../models/owner-model");
const productModel = require("../models/product-model");
const isOwnerLoggedIn = require("../middlewares/isOwnerLoggedIn");
const { generateToken } = require("../utils/generateToken");
const { hashPassword, verifyAndUpgradePassword } = require("../utils/password");

async function ownerRegistrationOpen() {
    const count = await ownerModel.countDocuments();
    return count === 0;
}

router.get("/register", async function(req, res) {
    if (req.cookies.ownerToken) return res.redirect("/owners/admin");
    if (req.cookies.token) return res.redirect("/shop");

    const canRegister = await ownerRegistrationOpen();
    if (!canRegister) {
        req.flash("error", "Owner registration is disabled. Please login.");
        return res.redirect("/owners/login");
    }

    const error = req.flash("error");
    const success = req.flash("success");
    res.render("owner-register", { error, success, loggedin: false, navRole: "guest" });
});

router.post("/register", async function(req, res) {
    try {
        const canRegister = await ownerRegistrationOpen();
        if (!canRegister) {
            req.flash("error", "Owner registration is disabled. Please login.");
            return res.redirect("/owners/login");
        }

        const { fullname, email, password } = req.body;
        if (!fullname || !email || !password) {
            req.flash("error", "Full name, email and password are required.");
            return res.redirect("/owners/register");
        }

        const existing = await ownerModel.findOne({ email: email.trim() });
        if (existing) {
            req.flash("error", "Owner with this email already exists.");
            return res.redirect("/owners/register");
        }

        const hashedPassword = await hashPassword(password);
        await ownerModel.create({
            fullname: fullname.trim(),
            email: email.trim(),
            password: hashedPassword,
        });

        req.flash("success", "Owner registered successfully. Please login.");
        return res.redirect("/owners/login");
    } catch (err) {
        req.flash("error", err.message);
        return res.redirect("/owners/register");
    }
});

router.get("/login", async function(req, res) {
    if (req.cookies.token) {
        req.flash("error", "You are logged in as user. Please logout first.");
        return res.redirect("/shop");
    }

    if (req.cookies.ownerToken) {
        return res.redirect("/owners/admin");
    }

    const canRegister = await ownerRegistrationOpen();
    if (canRegister) {
        req.flash("error", "No owner found. Please register first.");
        return res.redirect("/owners/register");
    }

    const error = req.flash("error");
    const success = req.flash("success");
    res.render("owner-login", { error, success, loggedin: false, navRole: "guest" });
});

router.post("/login", async function(req, res) {
    try {
        const { email, password } = req.body;
        const owner = await ownerModel.findOne({ email: (email || "").trim() });
        if (!owner) {
            req.flash("error", "Invalid owner credentials.");
            return res.redirect("/owners/login");
        }

        const { ok } = await verifyAndUpgradePassword(owner, password);
        if (!ok) {
            req.flash("error", "Invalid owner credentials.");
            return res.redirect("/owners/login");
        }

        const token = generateToken(owner, "owner");
        res.cookie("ownerToken", token);
        res.cookie("token", "");
        req.flash("success", "Owner login successful.");
        res.redirect("/owners/admin");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/owners/login");
    }
});

router.get("/logout", function(req, res) {
    res.cookie("ownerToken", "");
    res.redirect("/owners/login");
});

router.get("/admin", isOwnerLoggedIn, async function(req, res) {
    const products = await productModel.find().sort({ createdAt: -1 });
    const success = req.flash("success");
    const error = req.flash("error");
    res.render("createproducts", { success, error, products, navRole: "owner" });
});

router.get("/settings", isOwnerLoggedIn, async function(req, res) {
    const success = req.flash("success");
    const error = req.flash("error");
    res.render("owner-settings", { owner: req.owner, success, error, navRole: "owner" });
});

router.post("/settings/update", isOwnerLoggedIn, async function(req, res) {
    try {
        const owner = await ownerModel.findById(req.owner._id);
        if (!owner) {
            req.flash("error", "Owner not found.");
            return res.redirect("/owners/login");
        }

        const fullname = (req.body.fullname || "").trim();
        const email = (req.body.email || "").trim();
        const picture = (req.body.picture || "").trim();
        const gstin = (req.body.gstin || "").trim();
        const newPassword = req.body.newPassword || "";

        if (!fullname || !email) {
            req.flash("error", "Full name and email are required.");
            return res.redirect("/owners/settings");
        }

        const emailTaken = await ownerModel.findOne({
            email,
            _id: { $ne: owner._id },
        });
        if (emailTaken) {
            req.flash("error", "Email already in use by another owner.");
            return res.redirect("/owners/settings");
        }

        owner.fullname = fullname;
        owner.email = email;
        owner.picture = picture;
        owner.gstin = gstin;
        if (newPassword.trim()) {
            owner.password = await hashPassword(newPassword);
        }

        await owner.save();

        const refreshedToken = generateToken(owner, "owner");
        res.cookie("ownerToken", refreshedToken);
        req.flash("success", "Owner profile updated.");
        res.redirect("/owners/settings");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/owners/settings");
    }
});

router.post("/settings/delete", isOwnerLoggedIn, async function(req, res) {
    try {
        const owner = await ownerModel.findById(req.owner._id);
        if (!owner) {
            req.flash("error", "Owner not found.");
            return res.redirect("/owners/login");
        }

        const password = req.body.password || "";
        const { ok } = await verifyAndUpgradePassword(owner, password);
        if (!ok) {
            req.flash("error", "Incorrect password. Account not deleted.");
            return res.redirect("/owners/settings");
        }

        await ownerModel.findByIdAndDelete(owner._id);
        res.cookie("ownerToken", "");
        req.flash("success", "Owner account deleted. Registration is available again.");
        res.redirect("/owners/register");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/owners/settings");
    }
});

router.post("/settings/transfer", isOwnerLoggedIn, async function(req, res) {
    try {
        const owner = await ownerModel.findById(req.owner._id);
        if (!owner) {
            req.flash("error", "Owner not found.");
            return res.redirect("/owners/login");
        }

        const currentPassword = req.body.currentPassword || "";
        const newFullname = (req.body.newFullname || "").trim();
        const newEmail = (req.body.newEmail || "").trim();
        const newPassword = req.body.newPassword || "";

        if (!newFullname || !newEmail || !newPassword) {
            req.flash("error", "New owner full name, email, and password are required.");
            return res.redirect("/owners/settings");
        }

        const { ok } = await verifyAndUpgradePassword(owner, currentPassword);
        if (!ok) {
            req.flash("error", "Current owner password is incorrect.");
            return res.redirect("/owners/settings");
        }

        const emailTaken = await ownerModel.findOne({
            email: newEmail,
            _id: { $ne: owner._id },
        });
        if (emailTaken) {
            req.flash("error", "New owner email is already in use.");
            return res.redirect("/owners/settings");
        }

        owner.fullname = newFullname;
        owner.email = newEmail;
        owner.password = await hashPassword(newPassword);

        await owner.save();

        res.cookie("ownerToken", "");
        req.flash("success", "Ownership transferred successfully. Login using new owner credentials.");
        return res.redirect("/owners/login");
    } catch (err) {
        req.flash("error", err.message);
        return res.redirect("/owners/settings");
    }
});

module.exports = router;

const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const ownerModel = require("../models/owner-model");
const productModel = require("../models/product-model");
const isOwnerLoggedIn = require("../middlewares/isOwnerLoggedIn");
const { generateToken } = require("../utils/generateToken");

if (process.env.NODE_ENV === "development") {
    router.post("/create", async function(req, res) {
        try {
            let owners = await ownerModel.find();
            if (owners.length > 0) {
                return res.status(503).send("You don't have permission to create a new owner.");
            }

            let { fullname, email, password } = req.body;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            let createdOwner = await ownerModel.create({
                fullname,
                email,
                password: hashedPassword,
            });

            res.status(201).send(createdOwner);
        } catch (err) {
            res.status(500).send(err.message);
        }
    });
}

router.get("/login", function(req, res) {
    if (req.cookies.token) {
        req.flash("error", "You are logged in as user. Please logout first.");
        return res.redirect("/shop");
    }

    if (req.cookies.ownerToken) {
        return res.redirect("/owners/admin");
    }

    const error = req.flash("error");
    const success = req.flash("success");
    res.render("owner-login", { error, success, loggedin: false, navRole: "guest" });
});

router.post("/login", async function(req, res) {
    try {
        const { email, password } = req.body;
        const owner = await ownerModel.findOne({ email });
        if (!owner) {
            req.flash("error", "Invalid owner credentials.");
            return res.redirect("/owners/login");
        }

        const ok = await bcrypt.compare(password, owner.password);
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
    let success = req.flash("success");
    let error = req.flash("error");
    res.render("createproducts", { success, error, products, navRole: "owner" });
});

module.exports = router;

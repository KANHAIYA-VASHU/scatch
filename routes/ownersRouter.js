const express = require("express");
const router = express.Router();
const ownerModel = require("../models/owner-model");
const productModel = require("../models/product-model");


if(process.env.NODE_ENV === "development"){
    router.post("/create", async function(req, res){
        let owners = await ownerModel.find();
        if(owners.length > 0){
            return res
                .send(503)
                .send("You don't have premission to create a new owner.");
        }

        let { fullname, email, password } = req.body;

        let createdOwner = await ownerModel.create({
            fullname,
            email,
            password,
        });

        res.status(201).send(createdOwner);
    });
}

router.get("/admin", async function(req, res){
    const products = await productModel.find().sort({ createdAt: -1 });
    let success = req.flash("success");
    let error = req.flash("error");
    res.render("createproducts", { success, error, products });
});

module.exports = router;

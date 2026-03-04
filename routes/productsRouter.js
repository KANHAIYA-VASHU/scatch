const express = require("express");
const router = express.Router();
const upload = require("../config/multer-config");
const productModel = require("../models/product-model");

function parseProductBody(body) {
    return {
        name: body.name?.trim(),
        price: Number(body.price),
        discount: body.discount === "" || body.discount == null ? 0 : Number(body.discount),
        bgcolor: body.bgcolor?.trim(),
        panelcolor: body.panelcolor?.trim(),
        textcolor: body.textcolor?.trim() || "000000",
    };
}

function validateProductFields(product, body, requireImage, hasImage) {
    if (requireImage && !hasImage) return "Product image is required.";
    if (!product.name) return "Product name is required.";
    if (body.price == null || String(body.price).trim() === "") return "Valid product price is required.";
    if (Number.isNaN(product.price) || product.price < 0) return "Valid product price is required.";
    if (Number.isNaN(product.discount) || product.discount < 0) return "Discount must be 0 or more.";
    if (!product.bgcolor) return "Background color is required.";
    if (!product.panelcolor) return "Panel color is required.";
    return null;
}

router.post("/create", upload.single("image"), async function(req, res){
   try{
    const productData = parseProductBody(req.body);
    const validationError = validateProductFields(productData, req.body, true, !!req.file);
    if (validationError) {
        req.flash("error", validationError);
        return res.redirect("/owners/admin");
    }

    await productModel.create({
        image: req.file.buffer,
        ...productData,
    });

    req.flash("success", "Product created successfully.");
    res.redirect("/owners/admin");
    }catch(err){
        req.flash("error", err.message);
        res.redirect("/owners/admin");
    }
});

router.get("/edit/:id", async function(req, res){
    const product = await productModel.findById(req.params.id);
    if (!product) {
        req.flash("error", "Product not found.");
        return res.redirect("/owners/admin");
    }

    const success = req.flash("success");
    const error = req.flash("error");
    res.render("editproduct", { product, success, error });
});

router.post("/update/:id", upload.single("image"), async function(req, res){
    try {
        const productData = parseProductBody(req.body);
        const validationError = validateProductFields(productData, req.body, false, !!req.file);
        if (validationError) {
            req.flash("error", validationError);
            return res.redirect(`/products/edit/${req.params.id}`);
        }

        const existing = await productModel.findById(req.params.id);
        if (!existing) {
            req.flash("error", "Product not found.");
            return res.redirect("/owners/admin");
        }

        const updatePayload = {
            ...productData,
            image: req.file ? req.file.buffer : existing.image,
        };

        await productModel.findByIdAndUpdate(req.params.id, updatePayload, { runValidators: true });
        req.flash("success", "Product updated successfully.");
        res.redirect("/owners/admin");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect(`/products/edit/${req.params.id}`);
    }
});

router.post("/delete/:id", async function(req, res){
    try {
        const deletedProduct = await productModel.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            req.flash("error", "Product not found.");
            return res.redirect("/owners/admin");
        }
        req.flash("success", "Product deleted successfully.");
        res.redirect("/owners/admin");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/owners/admin");
    }
});

router.post("/delete-all", async function(req, res){
    try {
        await productModel.deleteMany({});
        req.flash("success", "All products deleted successfully.");
        res.redirect("/owners/admin");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/owners/admin");
    }
});

module.exports = router;

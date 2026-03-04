const express = require("express");
const router = express.Router();
const isloggedin = require("../middlewares/isLoggedIn");
const userModel = require("../models/user-model");
const productModel = require("../models/product-model");

function normalizeOrder(rawOrder, index) {
    if (!rawOrder || typeof rawOrder !== "object") {
        return {
            orderId: `ORD-${index + 1}`,
            itemsCount: 0,
            totalAmount: 0,
            status: "pending",
            trackingId: "",
            trackingStatus: "Not shipped yet",
            placedAt: null,
            eta: "",
        };
    }

    const normalizedStatus = ["pending", "current", "past"].includes(rawOrder.status)
        ? rawOrder.status
        : "pending";

    return {
        _id: rawOrder._id,
        orderId: rawOrder.orderId || `ORD-${index + 1}`,
        itemsCount: Number(rawOrder.itemsCount || 0),
        totalAmount: Number(rawOrder.totalAmount || 0),
        status: normalizedStatus,
        trackingId: rawOrder.trackingId || "",
        trackingStatus: rawOrder.trackingStatus || "Not shipped yet",
        placedAt: rawOrder.placedAt || null,
        eta: rawOrder.eta || "",
    };
}

function buildAddressPayload(body) {
    return {
        fullName: body.fullName?.trim(),
        phone: body.phone?.trim(),
        line1: body.line1?.trim(),
        line2: body.line2?.trim() || "",
        city: body.city?.trim(),
        state: body.state?.trim(),
        postalCode: body.postalCode?.trim(),
        country: body.country?.trim() || "India",
        isDefault: body.isDefault === "on",
    };
}

function validateAddress(address) {
    if (!address.fullName) return "Full name is required.";
    if (!address.phone) return "Phone is required.";
    if (!address.line1) return "Address line 1 is required.";
    if (!address.city) return "City is required.";
    if (!address.state) return "State is required.";
    if (!address.postalCode) return "Postal code is required.";
    return null;
}

router.get("/", function(req, res){
    let error = req.flash("error");
    res.render("index", { error , loggedin: false});
});

router.get("/shop", isloggedin, async (req, res)=>{
    const sortBy = req.query.sortby === "newest" ? "newest" : "popular";
    const sortOption =
        sortBy === "newest"
            ? { _id: -1 }
            : { discount: -1, _id: -1 };

    let products = await productModel.find().sort(sortOption);
    let success = req.flash("success");
    res.render("shop", { products, success, sortBy });
});

router.get("/account", isloggedin, async function(req, res){
    const user = await userModel.findOne({ email: req.user.email }).select("-password");
    if (!user) {
        req.flash("error", "User not found. Please login again.");
        return res.redirect("/users/logout");
    }
    const orders = (user.orders || []).map(normalizeOrder);
    const pendingOrders = orders.filter((order) => order.status === "pending");
    const currentOrders = orders.filter((order) => order.status === "current");
    const pastOrders = orders.filter((order) => order.status === "past");
    const success = req.flash("success");
    const error = req.flash("error");

    res.render("account", {
        user,
        pendingOrders,
        currentOrders,
        pastOrders,
        success,
        error,
    });
});

router.post("/account/profile/update", isloggedin, async function(req, res) {
    try {
        const existingUser = await userModel.findOne({ email: req.user.email });
        if (!existingUser) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }

        const fullname = req.body.fullname?.trim();
        const contact = req.body.contact?.trim() || "";
        const picture = req.body.picture?.trim() || "";

        if (!fullname) {
            req.flash("error", "Full name is required.");
            return res.redirect("/account");
        }

        await userModel.findOneAndUpdate(
            { email: req.user.email },
            { fullname, contact, picture },
            { runValidators: true }
        );
        req.flash("success", "Profile updated successfully.");
        res.redirect("/account");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/account");
    }
});

router.post("/account/addresses", isloggedin, async function(req, res) {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }
        user.addresses = user.addresses || [];
        const address = buildAddressPayload(req.body);
        const validationError = validateAddress(address);
        if (validationError) {
            req.flash("error", validationError);
            return res.redirect("/account");
        }

        if (address.isDefault) {
            user.addresses.forEach((item) => {
                item.isDefault = false;
            });
        } else if (!user.addresses.length) {
            address.isDefault = true;
        }

        user.addresses.push(address);
        await user.save();
        req.flash("success", "Address added successfully.");
        res.redirect("/account");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/account");
    }
});

router.post("/account/addresses/:addressId/update", isloggedin, async function(req, res) {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }
        user.addresses = user.addresses || [];
        const address = user.addresses.id(req.params.addressId);
        if (!address) {
            req.flash("error", "Address not found.");
            return res.redirect("/account");
        }

        const updatedAddress = buildAddressPayload(req.body);
        const validationError = validateAddress(updatedAddress);
        if (validationError) {
            req.flash("error", validationError);
            return res.redirect("/account");
        }

        if (updatedAddress.isDefault) {
            user.addresses.forEach((item) => {
                item.isDefault = false;
            });
        }

        Object.assign(address, updatedAddress);
        await user.save();
        req.flash("success", "Address updated successfully.");
        res.redirect("/account");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/account");
    }
});

router.post("/account/addresses/:addressId/delete", isloggedin, async function(req, res) {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }
        user.addresses = user.addresses || [];
        const address = user.addresses.id(req.params.addressId);
        if (!address) {
            req.flash("error", "Address not found.");
            return res.redirect("/account");
        }

        const wasDefault = address.isDefault;
        address.deleteOne();

        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }

        await user.save();
        req.flash("success", "Address deleted successfully.");
        res.redirect("/account");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/account");
    }
});

router.get("/cart", isloggedin, async function(req, res){
     let user = await userModel 
     .findOne({ email: req.user.email }) 
     .populate("cart"); 
     const subtotal = user.cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
     const totalDiscount = user.cart.reduce((sum, item) => sum + Number(item.discount || 0), 0);
     const platformFee = user.cart.length > 0 ? 20 : 0;
     const bill = subtotal + platformFee - totalDiscount;
     res.render("cart", { user, bill, subtotal, totalDiscount, platformFee });
    });



router.get("/addtocart/:productid", isloggedin, async function (req, res){
    let user = await userModel.findOne({email: req.user.email});
    user.cart.push(req.params.productid);
    await user.save();
    req.flash("success", "Added to cart");
    res.redirect("/shop");
})

router.get("/logout", isloggedin, function(req, res){
    res.redirect("/users/logout");
});
 
module.exports = router;

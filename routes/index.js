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

function buildCartLineItems(cartProducts = []) {
    const productMap = new Map();

    for (const product of cartProducts) {
        if (!product) continue;
        const id = String(product._id);

        if (!productMap.has(id)) {
            productMap.set(id, {
                productId: id,
                name: product.name,
                price: Number(product.price || 0),
                discount: Number(product.discount || 0),
                image: product.image,
                bgcolor: product.bgcolor,
                panelcolor: product.panelcolor,
                textcolor: product.textcolor,
                quantity: 0,
            });
        }

        productMap.get(id).quantity += 1;
    }

    return Array.from(productMap.values()).map((item) => ({
        ...item,
        mrpTotal: item.price * item.quantity,
        discountTotal: item.discount * item.quantity,
        lineTotal: (item.price - item.discount) * item.quantity,
    }));
}

function calculateCartSummary(lineItems = []) {
    const totalItems = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = lineItems.reduce((sum, item) => sum + item.mrpTotal, 0);
    const totalDiscount = lineItems.reduce((sum, item) => sum + item.discountTotal, 0);
    const platformFee = totalItems > 0 ? 20 : 0;
    const shippingFee = 0;
    const bill = subtotal - totalDiscount + platformFee + shippingFee;

    return { totalItems, subtotal, totalDiscount, platformFee, shippingFee, bill };
}

function getDefaultAddress(addresses = []) {
    if (!addresses.length) return null;
    return addresses.find((address) => address.isDefault) || addresses[0];
}

function randomDigits(length) {
    return Math.floor(Math.random() * 10 ** length).toString().padStart(length, "0");
}

router.get("/", function(req, res) {
    let error = req.flash("error");
    let success = req.flash("success");
    res.render("index", { error, success, loggedin: false, navRole: "guest" });
});

router.get("/shop", isloggedin, async (req, res) => {
    const sortBy = req.query.sortby === "newest" ? "newest" : "popular";
    const sortOption =
        sortBy === "newest"
            ? { _id: -1 }
            : { discount: -1, _id: -1 };

    let products = await productModel.find().sort(sortOption);
    let success = req.flash("success");
    res.render("shop", { products, success, sortBy, navRole: "user" });
});

router.get("/account", isloggedin, async function(req, res) {
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
        navRole: "user",
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

router.get("/cart", isloggedin, async function(req, res) {
    let user = await userModel
        .findOne({ email: req.user.email })
        .populate("cart");

    if (!user) {
        req.flash("error", "User not found. Please login again.");
        return res.redirect("/users/logout");
    }

    const populatedCart = (user.cart || []).filter(Boolean);
    if (populatedCart.length !== (user.cart || []).length) {
        user.cart = populatedCart.map((item) => item._id);
        await user.save();
    }

    const lineItems = buildCartLineItems(populatedCart);
    const { totalItems, subtotal, totalDiscount, platformFee, shippingFee, bill } = calculateCartSummary(lineItems);
    const success = req.flash("success");
    const error = req.flash("error");

    res.render("cart", {
        user,
        lineItems,
        totalItems,
        bill,
        subtotal,
        totalDiscount,
        platformFee,
        shippingFee,
        success,
        error,
        navRole: "user",
    });
});

router.post("/cart/item/:productId/increase", isloggedin, async function(req, res) {
    try {
        const { productId } = req.params;
        const product = await productModel.findById(productId);
        if (!product) {
            req.flash("error", "Product not found.");
            return res.redirect("/cart");
        }

        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }

        user.cart.push(productId);
        await user.save();
        req.flash("success", "Item quantity increased.");
        res.redirect("/cart");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/cart");
    }
});

router.post("/cart/item/:productId/decrease", isloggedin, async function(req, res) {
    try {
        const { productId } = req.params;
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }

        const matchingIndexes = [];
        user.cart.forEach((itemId, index) => {
            if (String(itemId) === productId) matchingIndexes.push(index);
        });

        if (matchingIndexes.length === 0) {
            req.flash("error", "Item not found in cart.");
            return res.redirect("/cart");
        }

        if (matchingIndexes.length <= 1) {
            req.flash("error", "Quantity cannot be less than 1. Use remove to delete item.");
            return res.redirect("/cart");
        }

        const removeAt = matchingIndexes[matchingIndexes.length - 1];
        user.cart.splice(removeAt, 1);
        await user.save();
        req.flash("success", "Item quantity decreased.");
        res.redirect("/cart");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/cart");
    }
});

router.post("/cart/item/:productId/remove", isloggedin, async function(req, res) {
    try {
        const { productId } = req.params;
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }

        const originalLength = user.cart.length;
        user.cart = user.cart.filter((itemId) => String(itemId) !== productId);

        if (user.cart.length === originalLength) {
            req.flash("error", "Item not found in cart.");
            return res.redirect("/cart");
        }

        await user.save();
        req.flash("success", "Item removed from cart.");
        res.redirect("/cart");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/cart");
    }
});

router.post("/cart/checkout/cod", isloggedin, async function(req, res) {
    try {
        const user = await userModel.findOne({ email: req.user.email }).populate("cart");
        if (!user) {
            req.flash("error", "User not found. Please login again.");
            return res.redirect("/users/logout");
        }

        const populatedCart = (user.cart || []).filter(Boolean);
        if (populatedCart.length !== (user.cart || []).length) {
            user.cart = populatedCart.map((item) => item._id);
        }

        const lineItems = buildCartLineItems(populatedCart);
        if (!lineItems.length) {
            req.flash("error", "Your cart is empty.");
            return res.redirect("/cart");
        }

        const defaultAddress = getDefaultAddress(user.addresses || []);
        if (!defaultAddress) {
            req.flash("error", "Please add a shipping address before placing order.");
            return res.redirect("/account");
        }

        const { totalItems, bill } = calculateCartSummary(lineItems);
        const orderId = `ORD-${Date.now()}${randomDigits(3)}`;
        const trackingId = `TRK-${randomDigits(8)}`;

        user.orders = user.orders || [];
        user.orders.push({
            orderId,
            itemsCount: totalItems,
            totalAmount: bill,
            status: "pending",
            trackingId,
            trackingStatus: "Order placed. Awaiting dispatch.",
            eta: "3-5 business days",
            paymentMethod: "COD",
            paymentStatus: "Pending on delivery",
            shippingAddress: {
                fullName: defaultAddress.fullName,
                phone: defaultAddress.phone,
                line1: defaultAddress.line1,
                line2: defaultAddress.line2,
                city: defaultAddress.city,
                state: defaultAddress.state,
                postalCode: defaultAddress.postalCode,
                country: defaultAddress.country,
            },
            items: lineItems.map((item) => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                unitDiscount: item.discount,
                lineTotal: item.lineTotal,
            })),
        });

        user.cart = [];
        await user.save();
        req.flash("success", `Order placed successfully (${orderId}). Payment mode: Cash on Delivery.`);
        res.redirect("/account");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/cart");
    }
});

router.get("/addtocart/:productid", isloggedin, async function(req, res) {
    let user = await userModel.findOne({ email: req.user.email });
    if (!user) {
        req.flash("error", "User not found. Please login again.");
        return res.redirect("/users/logout");
    }

    const product = await productModel.findById(req.params.productid);
    if (!product) {
        req.flash("error", "Product not found.");
        return res.redirect("/shop");
    }

    user.cart.push(req.params.productid);
    await user.save();
    req.flash("success", "Added to cart");
    res.redirect("/shop");
});

router.get("/logout", isloggedin, function(req, res) {
    res.redirect("/users/logout");
});

module.exports = router;

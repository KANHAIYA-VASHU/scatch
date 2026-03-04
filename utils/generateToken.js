const jwt = require("jsonwebtoken");

const generateToken = (account, role = "user") => {
    return jwt.sign(
        { email: account.email, id: account._id, role },
        process.env.JWT_KEY
    );
};

module.exports.generateToken = generateToken;

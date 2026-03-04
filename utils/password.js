const bcrypt = require("bcrypt");

function isBcryptHash(value) {
    return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function hashPassword(plainPassword) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt);
}

async function verifyAndUpgradePassword(accountDoc, plainPassword) {
    if (!accountDoc || typeof plainPassword !== "string") {
        return { ok: false, upgraded: false };
    }

    const storedPassword = accountDoc.password || "";

    if (isBcryptHash(storedPassword)) {
        const ok = await bcrypt.compare(plainPassword, storedPassword);
        return { ok, upgraded: false };
    }

    if (storedPassword === plainPassword) {
        accountDoc.password = await hashPassword(plainPassword);
        await accountDoc.save();
        return { ok: true, upgraded: true };
    }

    return { ok: false, upgraded: false };
}

module.exports = {
    isBcryptHash,
    hashPassword,
    verifyAndUpgradePassword,
};

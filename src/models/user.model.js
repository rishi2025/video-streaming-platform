import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        fullName: {
            type: String,
            required: true,
            lowercase: true,
        },

        avatar: {
            type: String,     // cloudinary URL
            required: true,
        },

        coverImage: {
            type: String,     // cloudinary URL
        },

        watchHistory: {
            type: Schema.Types.ObjectId,
            ref: "Video",
        },

        password: {
            type: String,
            required: [true, "Password is True"],
        },

        refreshTokens: {
            type: String,
        }
    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password"))
        return;

    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await this.compare(password, this.password);
};

userSchema.methods.generateAcessToken = async function (password) {
    jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        }
    )
};

userSchema.methods.generateRefreshToken = async function (password) {
    jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFERSH_TOKEN_EXPIRY,
        }
    )
};

export const User = mongoose.model("User", userSchema);
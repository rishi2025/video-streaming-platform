import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {

        const user = await User.findById(userId);

        const accessToken = user.generateAcessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { refreshToken, accessToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access and Refresh tokens...");
    }
};

const registerUser = asyncHandler(async (req, res) => {

    // get user details from frontend
    const { fullName, email, username, password } = req.body;


    // validation - not empty
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required...");
    }

    // const existingUsername = User.findOne({
    //     $or: [{ email }, { username }]
    // });


    // check if user already exists: username, email
    const existingUsername = await User.findOne({
        username
    });

    const existingEmail = await User.findOne({
        email
    });

    if (existingUsername || existingEmail)
        throw new ApiError(409, `${existingEmail ? "Email" : "Username"} already exists.`);


    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
        coverImageLocalPath = req.files?.coverImage[0].path;

    if (!avatarLocalPath)
        throw new ApiError(400, "Avatar file is required...");


    // upload them to cloudinary, avatar
    const avatar = await uploadCloudinary(avatarLocalPath);
    const coverImage = await uploadCloudinary(coverImageLocalPath);

    if (!avatar)
        throw new ApiError(400, "Avatar file is required...");


    // create user object - create entry in db
    const user = await User.create({
        fullName: fullName.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });


    // remove hashed password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshTokens"
    );


    // check for user creation
    if (!createdUser)
        throw new ApiError(500, "Something went wrong while registering the user...");


    // return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully !!!")
    )
});

const loginUser = asyncHandler(async (req, res) => {

    // data from request body
    const { email, username, password } = req.body;


    // username or email
    if (!username && !email)
        throw new ApiError(400, "Username or Email is required...");


    // find the user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (!user)
        throw new ApiError(400, "User does not exist...");


    // check password
    await user.isPasswordCorrect(password);

    if (!user)
        throw new ApiError(401, "Wrong Password...");


    // generate access and refresh tokens
    const { refreshToken, accessToken } = await generateAccessAndRefreshTokens(user._id);


    // send cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User Logged in successfully...",
            )
        )
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "Logged out Successfully")
        )
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
        if (!incomingRefreshToken)
            throw new ApiError(401, "Unauthorized request...");
    
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFERSH_TOKEN_SECRET
        );
    
        const user = await User.findById(decodedToken?._id);
    
        if (!user)
            throw new ApiError(401, "Invalid refresh token...");
    
        if (incomingRefreshToken !== user?.refreshToken)
            throw new ApiError(401, "Refresh token is expired or used...");
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { newRefreshToken, newAccessToken } = await generateAccessAndRefreshTokens(user._id);
    
        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                200,
                {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken
                },
                "Access Token Refreshed Succesfully..."
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token...");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isValidPassword = await user.isPasswordCorrect(oldPassword);

    if (!isValidPassword)
        throw new ApiError("Invalid old password");

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200)
        .json(new ApiResponse(
            200,
            {},
            "Password changed...",
        ))
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "Current user fetched successfully"
            )
        );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!fullname && !email)
        throw new ApiError(400, "All fields are required...");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email,
            }
        },
        { new: true },
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated..."));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath)
        throw new ApiError(400, "Avatar not found...");

    const avatar = uploadCloudinary(avatarLocalPath);

    if (!avatar)
        throw new ApiError(500, "Error while uploading avatar...");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            }
        },
        {
            new: true,
        }
    ).select("-password -refreshToken");

    return res.status(200)
        .json(
            new ApiResponse(200, user, "Avatar updated successfully...")
    )
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath)
        throw new ApiError(400, "CoverImage not found...");

    const coverImage = uploadCloudinary(coverImageLocalPath);

    if (!coverImage)
        throw new ApiError(500, "Error while uploading CoverImage...");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            }
        },
        {
            new: true,
        }
    ).select("-password -refreshToken");

    return res.status(200)
        .json(
            new ApiResponse(200, user, "Avatar updated successfully...")
    )
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
};
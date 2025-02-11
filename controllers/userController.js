const { UserModel } = require("../models/userModel.js");
const { PostModel } = require("../models/postModel.js");
const bcrypt = require("bcrypt");

// nft and erc-20
const nftService = require("../contractService/nftService.js");
const tokenService = require("../contractService/tokenService.js");
//

const { validationResult } = require("express-validator");
const loginForm = (req, res) => {
  let error = null
  if(typeof req.session.message !== "undefined") {
    if(typeof  req.session.message.loginError !== "undefined" && req.session.message.loginError.length !== 0){
      error = req.session.message.loginError;
      delete req.session.message.loginError;
    }
  }
    res.render("login_page", {
      title: "Login Page",
      IsAuthorized: req.session.authorized,
      error: error,
    });
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const mappedErrors = errors.mapped();
      return res.render("login_page", {
        title: "Login Page",
        IsAuthorized: req.session.authorized,
        passwordError: mappedErrors.password,
        emailError: mappedErrors.email,
      });
    }

    const user = await UserModel.findOne({
      email: req.body.email,
    });

    if (!user) {
      res.render("login_page", {
        title: "Login Page",
        IsAuthorized: req.session.authorized,
        error: "Wrong login or password",
      });
      return;
    }

    const isValidPass = await bcrypt.compare(
      req.body.password,
      user.passwordHash
    );

    if (!isValidPass) {
      res.render("login_page", {
        title: "Login Page",
        IsAuthorized: req.session.authorized,
        error: "Wrong login or password",
      });
      return;
    }

    req.session.authorized = true;
    req.session.userId = user._id;

    res.redirect("/");
  } catch (e) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

const registrationForm = (req, res) => {
  res.render("register_page", {
    title: "Register Page",
    IsAuthorized: req.session.authorized,
  });
};

const registration = async (req, res) => {
  try {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const mappedErrors = errors.mapped();
      return res.render("register_page", {
        title: "Register Page",
        IsAuthorized: req.session.authorized,
        nameError: mappedErrors.name,
        passwordError: mappedErrors.password,
        emailError: mappedErrors.email,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHashed = await bcrypt.hash(req.body.password, salt);

    const doc = new UserModel({
      email: req.body.email,
      name: req.body.name,
      passwordHash: passwordHashed,
    });

   await doc.save();

    res.redirect("/user/login");
  } catch (e) {
    res.status(500).json({
      message: e,
    });
  }
};
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Error logging out");
    }
    res.clearCookie("connect.sid");
    res.redirect("/user/login");
  });
};

const home = async (req, res) => {
  let IsAuthorized = req.session.authorized;
  if (!IsAuthorized) {
    IsAuthorized = false;
  }


  const userId = req.session.userId;
  try {
    const posts = await PostModel.find({})
      .populate("author", "name")
      .sort({ createdAt: -1 });

    res.render("home_page", {
      title: "Home Page",
      IsAuthorized: IsAuthorized,
      userId: userId,
      posts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

const friendsPageForm = async (req, res) => {
  let IsAuthorized = req.session.authorized;
  const userId = req.session.userId;
  try {
    const user = await UserModel.findById(userId)
      .populate("friendRequests", "name _id")
      .populate("friends", "name _id");

    res.render("friends_page", {
      title: `${user.name}'s Friends`,
      IsAuthorized: IsAuthorized,
      currentUser: user,
      currentUserId: userId,
      friendRequests: user.friendRequests,
      friends: user.friends,
      friendsCount: user.friends.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

const profileForm = async (req, res) => {
  let IsAuthorized = req.session.authorized;
  try {
    const currentUserId = req.session.userId;
    const requestedUserId = req.params.userId || currentUserId;

    const user = await UserModel.findById(requestedUserId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    const hasTopWeb3NFT = user.hasTopWeb3NFT;
    console.log(PostModel);
    const posts = await PostModel.find({ author: requestedUserId })
      .populate({
        path: "comments",
        populate: {
          path: "author",
          model: "User",
          select: "name",
        },
      })
      .sort({ createdAt: -1 }); // user's posts

    const isCurrentUser = requestedUserId === currentUserId;
    let currentUser = null;
    let balance = null;
    if (!isCurrentUser) {
      currentUser = await UserModel.findById(currentUserId);
    } else {
      balance = await tokenService.getBalance(user.walletAddress);
    }


    res.render("profile_page", {
      title: `${user.name}'s Profile`,
      IsAuthorized: IsAuthorized,
      user: user,
      currentUser: isCurrentUser ? user : currentUser,
      isCurrentUser: isCurrentUser,
      wallet: user.walletAddress,
      userId: user._id,
      posts: posts,
      hasTopWeb3NFT: hasTopWeb3NFT,
      balance: balance,
      isFriends: user.friends.includes(currentUserId),
      isRequested: user.friendRequests.includes(currentUserId)
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

const profileWallet = async (req, res) => {
  const { walletAddress } = req.body;
  const userId = req.session.userId;

  try {
    const user = await UserModel.findById(userId);
    user.walletAddress = walletAddress;
    await user.save();

    return res.render("profile_page", {
      title: "Profile",
      IsAuthorized: req.session.IsAuthorized,
      wallet: user.walletAddress,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

const profileGetWalletAddress = async (req, res) => {
  const userId = req.session.userId;

  try {
    const user = await UserModel.findById(userId);
    if (user.walletAddress) {
      res.json({ walletAddress: user.walletAddress });
    } else {
      res.json({ walletAddress: null });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

///////// avatar ///////////
const updateAvatar = async (req, res) => {
  try {
    res.redirect("/user/profile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

///////// friend requests //////////

const sendFriendRequest = async (req, res) => {
  const { userId, friendId } = req.body;

  try {
    if (userId === friendId) {
      return res.status(400).send("Error");
    }

    const user = await UserModel.findById(userId);
    const friend = await UserModel.findById(friendId);

    if (!friend) {
      return res.status(404).send("User not found");
    }

    if (
      friend.friendRequests.includes(userId) ||
      user.friends.includes(friendId)
    ) {
      return res.status(400).send("Request already sent");
    }

    friend.friendRequests.push(userId);
    await friend.save();

    res.status(200).send("Request sent");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

//// CHECK AMOUNT OF FRIENDS AND GIVE NFT
async function checkAndAwardNFT(userId) {
  try {
    const user = await UserModel.findById(userId);
    const friendsCount = user.friends.length;

    if (friendsCount >= 5 && !user.hasTopWeb3NFT) {
      const tokenURI = "ipfs://QmSMBXnRC2n9aGkxbGh83Doib4jiKfJ8fb56Qtg74ZGgTL";
      const awarded = await nftService.awardNFT(user.walletAddress, tokenURI);

      if (awarded) {
        user.hasTopWeb3NFT = true;
        await user.save();
        console.log(
          `NFT was successfully issued to the user with ID ${userId}`
        );
      }
    }
  } catch (error) {
    console.error(`Error with issuing NFT to user with ID ${userId}: ${error}`);
  }
}

////

const acceptFriendRequest = async (req, res) => {
  const { userId, requestId } = req.body;

  // console.log("Accepting friend request with data:", { userId, requestId });

  try {
    const user = await UserModel.findById(userId);
    const requestingUser = await UserModel.findById(requestId);

    if (!user || !requestingUser) {
      return res.status(404).send("User not found");
    }

    if (
      user.friendRequests
        .map((id) => id.toString())
        .includes(requestId.toString())
    ) {
      user.friendRequests.pull(requestId);

      user.friends.push(requestId);
      requestingUser.friends.push(userId);

      user.friendsCount += 1;
      requestingUser.friendsCount += 1;

      await user.save();
      await requestingUser.save();

      await checkAndAwardNFT(user._id);
      await checkAndAwardNFT(requestingUser._id);

      res.status(200).send("Friend request accepted");
    } else {
      res.status(404).send("Friend request not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

const declineFriendRequest = async (req, res) => {
  const { userId, requestId } = req.body;
  try {
    const user = await UserModel.findById(userId);
    const requestingUser = await UserModel.findById(requestId);

    if (!user || !requestingUser) {
      return res.status(404).send("User not found");
    }

    if (
      user.friendRequests
        .map((id) => id.toString())
        .includes(requestId.toString())
    ) {
      user.friendRequests.pull(requestId);
      await user.save();
      res.status(200).send("Friend request declined");
    } else {
      res.status(404).send("Friend request not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

module.exports = {
  loginForm,
  login,
  registrationForm,
  registration,
  logout,
  home,
  profileForm,
  profileWallet,
  profileGetWalletAddress,
  updateAvatar,
  friendsPageForm,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
};

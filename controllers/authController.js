const passport = require("passport");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const crypto = require("crypto");
const promisify = require("es6-promisify");
const mail = require("../handlers/mail");

exports.login = passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: "Failed Login!",
  successRedirect: "/",
  successFlash: "You are now logged in!"
});

exports.logout = (req, res) => {
  req.logout();
  req.flash("success", "You are now logged out!");
  res.redirect("/");
};

exports.isLogin = (req, res, next) => {
  //first check if the user is auth
  if (req.isAuthenticated()) {
    next(); // carry on
    return;
  } else {
    req.flash("error", "Oops you must be logged in to add store");
    res.redirect("/login");
  }
};

exports.forgot = async (req, res) => {
  //1. See if a user with that emails exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "A password reset has been sent to you");
    return res.redirect("/login");
  }
  //2. Set reset tokens and expyri on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000; //1 hour from now
  await user.save();
  //3. Send them an email wiht the token
  const resetURL = `http://${req.headers.host}/account/reset/${
    user.resetPasswordToken
  }`;
  await mail.send({
    user,
    subject: "Password reset",
    resetURL,
    filename: "password-reset"
  });
  req.flash("success", `A password reset has been sent to you`);
  //4. redirect to login page
  res.redirect("/login");
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() } //$gt = greater than
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or token has expired");
    res.redirect("/login");
  }
  // if there is a user , show the restpassword form
  res.render("reset", { title: "reset your password" });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body["password-confirmed"]) {
    return next();
  }
  req.flash("error", "passwords don't match");
  res.redirect("back");
};

exports.updatePassword = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() } //$gt = greater than
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or token has expired");
    res.redirect("/login");
  }
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  //undefined erase the field in mongodb
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  // login auto grace au plugin passport
  await req.login(updatedUser);
  req.flash("success", "Password updated");
  res.redirect("/");
};

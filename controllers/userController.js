const mongoose = require("mongoose");
const User = mongoose.model("User");
const promisify = require("es6-promisify");

exports.loginForm = (req, res) => {
  res.render("login", { title: "login Form" });
};

exports.registerForm = (req, res) => {
  res.render("register", { title: "Register Form" });
};

exports.validateRegister = (req, res, next) => {
  req.sanitizeBody("name");
  req.checkBody("name", "You must supply a name").notEmpty();
  req.sanitizeBody("email").normalizeEmail({
    remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false
  });
  req.checkBody("email", "That email is not valid!").isEmail();
  req.checkBody("password", "Password Cannot be blank").notEmpty();
  req
    .checkBody("password-confirm", "Confirmed Password Cannot be blank")
    .notEmpty();
  req
    .checkBody("password-confirm", "Oops passwords don't match")
    .equals(req.body.password);

  const errors = req.validationErrors();
  if (errors) {
    req.flash("error", errors.map(err => err.msg));
    res.render("register", {
      title: "Register",
      body: req.body,
      flashes: req.flash()
    });
    return; // stop the fn from running
  }
  next(); // there were no errors !
};

exports.register = async (req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name });
  const register = promisify(User.register, User);
  await register(user, req.body.password);
  next(); //pass to authController.login
};

exports.account = (req, res) => {
  res.render("account", { title: "Edit your account" });
};

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email
  };
  //1. find and update the user given the ID
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    { $set: updates },
    { new: true, runValidators: true, context: "query" }
  );
  req.flash("success","updated the profile");
res.redirect('back');
};

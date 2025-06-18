module.exports = function(req, res, next){
    if(req.session.email === undefined){
        res.redirect('/cf');
    } else {
        next();
    }
};

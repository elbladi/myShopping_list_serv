const express = require('express');
// const checkAuth = require('../middleware/check-auth');
const itemsController = require('../controller/Items-Controller');

const router = express.Router();

// router.use(checkAuth);

router.get('/getItems', itemsController.getItems);
router.patch('/addItem', itemsController.addItem);
router.patch('/deleteItem', itemsController.deleteItem);


router.post('/addToCar/:name', itemsController.addToCar);
router.post('/removeToCar/:name', itemsController.removeToCar);
router.post('/sendEmail', itemsController.sendMail);
router.get('/getCar', itemsController.getCar);

module.exports = router;
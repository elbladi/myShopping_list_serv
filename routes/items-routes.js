const express = require('express');
// const checkAuth = require('../middleware/check-auth');
const itemsController = require('../controller/Items-Controller');
const fileUpload = require('../middleware/file-upload');
const deleteFile = require('../middleware/delete-file');
const router = express.Router();

// router.use(checkAuth);


router.get('/getItems', itemsController.getItems);
router.patch('/addItem', itemsController.addItem);
router.patch('/deleteItem', itemsController.deleteItem);


router.post('/addToCar/:name', itemsController.addToCar);
router.post('/removeToCar/:name', itemsController.removeToCar);
router.post('/sendEmail', itemsController.sendMail);
router.get('/getCar/:carId', itemsController.getCar);
router.post('/goShop', itemsController.goShop);
router.post('/setOrder', itemsController.setOrder);

router.patch('/updateOrderedList', itemsController.updateOrderedList);

router.post('/uploadItem', fileUpload.single('image'), itemsController.uploadItem)

router.post('/removeBackground', fileUpload.single('image'), itemsController.removeBackground)
router.patch('/deleteContent', itemsController.deleteContent)

module.exports = router;
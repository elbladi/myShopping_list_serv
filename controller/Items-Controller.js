const HttpError = require('../util/http-error');
const db = require('../database/config');
const fs = require('fs');
const io = require('../socket');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const removd = require('removd');
const Blob = require('node-fetch');
const transporter = nodemailer.createTransport(sendgridTransport({
    auth: {
        api_key: process.env.MAILER_ID
    }
}));
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const sendMail = (req, res, next) => {

    let today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(months[today.getMonth()]);
    const yyyy = today.getFullYear();

    today = dd + '/' + mm + '/' + yyyy;

    try {
        let listOfItems = [...req.body.items];

        let html = `<h1>Your shop list of ${today} is here:</h1><br><ul style="font-size: 1.5rem;">`
        listOfItems.forEach(item => {
            let itemName = item.replace('_', ' ');
            itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
            html += '<li style="margin: 10px 0;">' + itemName + '</li>'
        })
        html += '</ul>';

        db.firebase.database().ref(`car/`).remove()
            .then(resp => {
                transporter.sendMail({
                    to: ['yourMail@gmail.com'],
                    from: 'verifiedMail@hotmail.com',
                    subject: `${today} Shop list! `,
                    html: html
                })
                    .then(resp => {
                        res.json({
                            mail: 'MAIL SENDED'
                        });
                    })
                    .catch(err => {
                        return next(new HttpError(err, 404))
                    })
            })
            .catch(err => next(new HttpError(err, 404)))

    } catch (error) {
        return next(new HttpError(error, 404))
    }
}

const addToCar = async (req, res, next) => {
    const name = req.params.name;

    if (!name) return next(new HttpError('Entradas invalidas', 503));

    let listRef = db.firebase.firestore().collection('orderedList');

    let listExist
    let items;
    try {
        await listRef.get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    listExist = doc.id
                    items = doc.data().car
                })
            })
            .catch(err => {
                throw err
            })
    } catch (error) {
        return next(new HttpError(error, 503));
    }

    if (!listExist) { //list dont exist
        try {
            await listRef.add({
                car: [
                    {
                        name: name,
                        checked: false
                    }
                ]
            }).then(docRef => {
                res.json({ message: `${name} ADDED TO CAR`, docId: docRef.id })
            })
                .catch(_ => {
                    throw err
                });
        } catch (error) {
            return next(new HttpError('Algo salio bad', 503));
        }
    } else {
        try {
            await listRef.doc(listExist).update({
                car: [
                    ...items,
                    {
                        name: name,
                        checked: false
                    }]
            }).then(_ => {
                res.json({ message: `${name} ADDED TO CAR`, docId: listExist })
            }).catch(err => {
                throw err;
            })
        } catch (error) {
            return next(new HttpError('Algo salio bad', 503));
        }
    }
}

const removeToCar = async (req, res, next) => {
    const name = req.params.name;
    const { carId } = req.body;

    if (!name || carId === '0') return next(new HttpError('Entradas invalidas!', 503));

    let actualCar;
    const carRef = db.firebase.firestore().collection('orderedList').doc(carId);

    try {
        await carRef.get()
            .then(doc => {
                if (doc.exists) actualCar = [...doc.data().car]
                else next(new HttpError('No se pudo encontrar la lista', 500));
            })
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    if (!actualCar) return next(new HttpError('Algo salio mal!', 503));

    let newCarList = actualCar.filter(item => item.name !== name);

    try {
        await carRef.update({
            car: newCarList
        })
            .catch(_ => next(new HttpError('No se pudo actualizar la lista', 500)))
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    res.json({ message: `${name} REMOVED TO CAR` })

}

const getItems = async (req, res, next) => {

    let items;
    try {
        await db.firebase.firestore().collection('items').get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    items = {
                        ...items,
                        [doc.id]: doc.data()
                    }
                });
            })
    } catch (error) {
        return next(new HttpError(error.message, 500));
    }

    let deleted;
    try {
        await db.firebase.firestore().collection('deleted')
            .get().then(snapshot => {
                snapshot.forEach(doc => {
                    deleted = {
                        ...doc.data(),
                    }
                })
            }).catch(err => { throw err })
    } catch (error) {
        deleted = false;
    }

    if (!deleted) deleted = null;

    res.json({ items, deleted });

}

const addItem = async (req, res, next) => {
    const { itemId } = req.body;
    let current;
    let ref = db.firebase.firestore().collection('items').doc(itemId);

    try {
        await ref.get().then(doc => {
            if (!doc.exists) return next(new HttpError(error.message, 503));
            current = { ...doc.data() };
        })
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    if (!current) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    try {
        await ref.update({
            count: current.count + 1
        }).catch(err => next(new HttpError('Not Updated. Please, try again', 503)))
    } catch (error) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    io.getIO().emit('added', { itemId });
    res.json({
        message: `${current.name} UPDATED`
    })

};

const deleteItem = async (req, res, next) => {
    const { itemId } = req.body;
    let current;
    let ref = db.firebase.firestore().collection('items').doc(itemId);

    try {
        await ref.get().then(doc => {
            if (!doc.exists) return next(new HttpError(error.message, 503));
            current = { ...doc.data() };
        })
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    if (!current) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    try {
        await ref.update({
            count: current.count - 1
        }).catch(err => next(new HttpError('Not Updated. Please, try again', 503)))
    } catch (error) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    io.getIO().emit('deleted', { itemId });
    res.json({
        message: `${current.name} UPDATED`
    })
}

const getCar = async (req, res, next) => {

    const docId = req.params.carId;
    if (docId === '0') {
        try {
            let itemsInList;
            let carId;
            await db.firebase.firestore().collection('orderedList').get()
                .then(snapshot => {
                    snapshot.forEach(doc => {
                        itemsInList = doc.data().car;
                        carId = doc.id
                    })
                    res.status(200).json({ car: [...itemsInList], carId });
                })
                .catch(err => {
                    res.status(200).json({ car: [], carId: 0 });
                })
        } catch (error) {
        }
    } else {
        try {
            await db.firebase.firestore().collection('orderedList').doc(docId).get()
                .then(doc => {
                    if (doc.exists) {
                        res.status(200).json({ car: [...doc.data().car], carId: doc.id });
                    } else {
                        res.status(200).json({ car: [], carId: 0 });
                    }
                }).catch(err => {
                    res.status(200).json({ car: [], carId: 0 });
                })
        } catch (err) {
        }
    }

}

const goShop = (req, res, next) => {
}

const setOrder = async (req, res, next) => {
    /**
     * upload the list array
     */
    const { carId, newArray } = req.body;

    try {
        await db.firebase.firestore().collection('orderedList').doc(carId)
            .update({
                car: newArray
            })
            .then(() => {
                res.status(200).send('Ok');
            })
            .catch(err => next(new HttpError(err.message, 503)))
    } catch (error) {
        return next(new HttpError(error.message, 503))
    }
}

const updateOrderedList = async (req, res, next) => {

    const { newList, carId } = req.body;

    let dbRef = db.firebase.firestore().collection('orderedList');

    let createdId
    try {
        await dbRef.add({
            car: [...newList]
        }).then(docRef => createdId = docRef.id)
            .catch(err => {
                throw err;
            })
    } catch (error) {
        return next(new HttpError(error.message, 503))
    }

    if (!createdId) return next(new HttpError('No se pudo crear nueva lista', 503))

    try {
        await dbRef.doc(carId).delete()
            .then(_ => {
                res.json({ carId: createdId })
            })
            .catch(err => {
                throw err;
            });
    } catch (error) {
        return next(new HttpError(error.message, 503))
    }
}


const uploadItem = async (req, res, next) => {

    const { name, user } = req.body;
    const filePath = req.file.path;

    try {
        if (user === 'bladi') fs.createReadStream(filePath).pipe(fs.createWriteStream(`images/beli/${name}.png`));
        else fs.createReadStream(filePath).pipe(fs.createWriteStream(`images/bladi/${name}.png`));

    } catch (error) {
        return next(new HttpError(error.message), 500);
    }

    try {
        await db.firebase.firestore().collection('items').add({
            name: name,
            count: 0
        }).then(_ => {
            res.status(201).json();
        }).catch(err => next(new HttpError(err.message), 500))
    } catch (error) {
        return next(new HttpError(error.message), 500);
    }
}


const removeBackground = async (req, res, next) => {

    const filePath = req.file.path;

    try {
        const done = await removd.file({
            deleteOriginal: true,
            detect: 'product',
            format: 'png',
            destination: filePath,
            source: filePath,
            apikey: process.env.REMOVE_BG_KEY
        })


        if (done.error) {
            const path = filePath.split('/');
            res.json({
                image: `/${path[1]}/${path[2]}`
            });
        } else {
            const parts = done.destination.split('/');
            res.json({
                image: `/tempImg/${parts[parts.length - 1]}`
            });
        }

    } catch (error) {
        console.log('error:')
        console.log(error)
        return next(new HttpError(error.message), 500);
    }

}

const updateDeletedCollection = async (name) => {
    let backupId;

    let docId;
    try {
        await db.firebase.firestore().collection('deleted').get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    docId = doc.id
                });
            }).catch(err => { throw err })
    } catch (error) {
        docId = false;
    }

    if (docId) {
        //update
        try {
            await db.firebase.firestore().collection('deleted').doc(docId).update({ name: name })
                .then(_ => backupId = docId)
                .catch(err => { throw err })
        } catch (error) {
            backupId = false;
        }
    } else {
        //create
        try {
            await db.firebase.firestore().collection('deleted').add({
                name: name
            }).then(resp => {
                backupId = resp.id
            }).catch(err => { throw err })
        } catch (error) {
            backupId = false
        }
    }

    if (!backupId) return next(new HttpError('Backup could not be performed'), 500);
}


const deleteContent = async (req, res, next) => {
    const { itemId, name } = req.body;

    //agregar el item a la collection 'deleted'
    await updateDeletedCollection(name);

    //copiar la imagen en otro folder 'deleted'
    try {
        if (fs.existsSync(`./images/bladi/${name}.png`)) {
            fs.copyFileSync(`./images/bladi/${name}.png`, `./images/bladi/deleted/${name}.png`, err => {
                console.log(err);
                return next(new HttpError('Could not backup bladi image'), 500);
            })
        }
        if (fs.existsSync(`./images/beli/${name}.png`)) {
            fs.copyFileSync(`./images/beli/${name}.png`, `./images/beli/deleted/${name}.png`, err => {
                console.log(err);
                return next(new HttpError('Could not backup beli image'), 500);
            })
        }

    } catch (error) {
        return next(new HttpError('Something went wrong at image backup'), 500);
    }

    let deleted;
    try {
        deleted = await db.firebase.firestore().collection('items').doc(itemId).delete()
            .then(_ => deleted = true)
            .catch(_ => deleted = false);
    } catch (error) {
        deleted = false
    }

    if (!deleted) return next(new HttpError(error.message), 500);

    try {
        if (fs.existsSync(`./images/bladi/${name}.png`)) fs.unlink(`images/bladi/${name}.png`, _ => { })
        if (fs.existsSync(`./images/beli/${name}.png`)) fs.unlink(`images/beli/${name}.png`, _ => { })

    } catch (_) { }

    io.getIO().emit('deleteContent', { itemId });
    res.status(200).json({});

}

const undoDeleteItem = async (req, res, next) => {
    const name = req.params.name;
    if (!name) return next(new HttpError('Invalid input'), 500);

    //copy item image into respective folder (bladi, beli)
    try {
        if (fs.existsSync(`./images/bladi/deleted/${name}.png`)) {
            fs.copyFileSync(`./images/bladi/deleted/${name}.png`, `./images/bladi/${name}.png`, err => {
                console.log(err);
                return next(new HttpError('Could not backup bladi image'), 500);
            })
        }
        if (fs.existsSync(`./images/beli/deleted/${name}.png`)) {
            fs.copyFileSync(`./images/beli/deleted/${name}.png`, `./images/beli/${name}.png`, err => {
                console.log(err);
                return next(new HttpError('Could not backup beli image'), 500);
            })
        }

    } catch (error) {
        return next(new HttpError('Error at: copy item image into respective folder'), 500);
    }

    //insert into items collection
    let newItemId;
    try {
        await db.firebase.firestore().collection('items').add({
            name: name,
            count: 0
        }).then(doc => {
            newItemId = doc.id
        }).catch(err => { throw err })
    } catch (error) {
        newItemId = false;
    }

    if (!newItemId) return next(new HttpError('Error at: adding item to items collection'), 500);

    //delete item name from 'delete'collection
    let docId;
    try {
        await db.firebase.firestore().collection('deleted').get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    docId = doc.id
                });
            }).catch(err => {
                return next(new HttpError('Error at: getting item from deleted collection'), 500);
            })

        if (!docId) return next(new HttpError('Error at: getting item from deleted collection'), 500);

        await db.firebase.firestore().collection('deleted').doc(docId).delete()
            .then(_ => {
                docId = true;
            }).catch(err => { throw err })

    } catch (error) {
        docId = false;
    }
    if (!docId) return next(new HttpError('Error at: delete item name from "delete" collection'), 500);

    //delete the item image from respective 'deleted' folder;
    try {
        if (fs.existsSync(`./images/bladi/deleted/${name}.png`)) fs.unlink(`images/bladi/deleted/${name}.png`, _ => { })
        if (fs.existsSync(`./images/beli/deleted/${name}.png`)) fs.unlink(`images/beli/deleted/${name}.png`, _ => { })
    } catch (error) {
        return next(new HttpError('Error at: delete item image from "delete" folders'), 500);
    }

    io.getIO().emit('undoDeleteItem', { newItemId, name });
    res.status(200).json(newItemId);

}

exports.getItems = getItems;
exports.addItem = addItem;
exports.deleteItem = deleteItem;
exports.sendMail = sendMail;
exports.addToCar = addToCar;
exports.removeToCar = removeToCar;
exports.getCar = getCar;
exports.goShop = goShop;
exports.setOrder = setOrder;
exports.updateOrderedList = updateOrderedList;
exports.uploadItem = uploadItem;
exports.removeBackground = removeBackground;
exports.deleteContent = deleteContent;
exports.undoDeleteItem = undoDeleteItem;
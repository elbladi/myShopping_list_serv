const fs = require('fs').promises
const path = require('path')


module.exports = (req, res, next) => {

    try {
        const FOLDER_TO_REMOVE = 'images/tempImg';
        fs.readdir(FOLDER_TO_REMOVE).then(files => {
            const unlinkPromises = files.map(file => {
                const filePath = path.join(FOLDER_TO_REMOVE, file)
                return fs.unlink(filePath);
            })

            return Promise.all(unlinkPromises);
        }).catch(err => {
            throw err;
        })

        next();
    } catch (error) {
        console.log('error:')
        console.log(error);
    }

}
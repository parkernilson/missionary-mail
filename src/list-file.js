/**
 * A list file is a txt file which lists items separated by \n
 */


/**
 * Get an array from the data from a txt file of items
 * separated by \n
 */
function getItemArrayFromListFileData(itemListData) {
    return itemListData === "" ? [] : itemListData.split('\n')
}

/**
 * Get an array of items from a txt file of
 * things separated by \n
 */
function getItemArrayFromListFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err)
            } else {
                const items = getItemArrayFromListFileData(data)
                resolve(items)
            }
        })
    })
}

/**
 * Add an item to a list of items in a txt file
 * separated by \n
 */
function addItemToListFile(item, filePath) {
    return new Promise((resolve, reject) => {
        getItemArrayFromFile(filePath).then(items => {
            if (!items.includes(item)) {
                const append = items.length > 0 ? `\n${item}` : `${item}`
                fs.appendFile(filePath, append, (err) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve([...items, item])
                    }
                })
            }
        }).catch(error => {
            reject(error)
        })
    })
}

/**
 * Remove an item from a list of items in a txt file
 * separated by \n
 */
function removeItemFromListFile(item, filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            data = data.replace(`\n${item}`, '')
            data = data.replace(`${item}`, '')

            fs.writeFile(filePath, data, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(getItemArrayFromItemListData(data))
                }
            })
        })
    })
}

/**
 * Get a comma separated list of items from an array
 * e.g. 'a, b, c'
 */
function getCommaListFromArray(arr) {
    return arr.reduce((acc, cur, i) => {
        return acc + (i > 0 ? `, ${cur}` : `${cur}`)
    }, "")
}

module.exports = {
    getItemArrayFromListFile,
    addItemToListFile,
    removeItemFromListFile,
    getCommaListFromArray
}
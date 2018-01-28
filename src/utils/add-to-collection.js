/**
 * Add an item into a collection, if the collection is not an array
 * we create one and add the item to it
 * @param   {array} collection - target collection
 * @param   {*} item - item to add to the collection
 * @returns {array} array containing the new item added to it
 */
export default function addToCollection(collection = [], item) {
  collection.push(item)
  return collection
}
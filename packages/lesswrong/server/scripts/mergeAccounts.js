/* global Vulcan */
import Users from 'meteor/vulcan:users';
import { editMutation, getCollection, Utils } from 'meteor/vulcan:core';
import { Revisions } from '../../lib/index';
import { editableCollectionsFields } from '../../lib/editor/make_editable'
import ReadStatuses from '../../lib/collections/readStatus/collection';
import { Votes } from '../../lib/collections/votes/index';
import { Conversations } from '../../lib/collections/conversations/collection'



const transferOwnership = async ({documentId, targetUserId, collection, fieldName = "userId"}) => {
  await editMutation({
    collection,
    documentId,
    set: {[fieldName]: targetUserId},
    unset: {},
    validate: false,
  })
}

const transferCollection = async ({sourceUserId, targetUserId, collectionName, fieldName = "userId"}) => {
  const collection = getCollection(collectionName)
  const documents = await collection.find({[fieldName]: sourceUserId}).fetch()
  // eslint-disable-next-line no-console
  console.log(`Transferring ${documents.length} documents in collection ${collectionName}`)
  for (const doc of documents) {
    await transferOwnership({documentId: doc._id, targetUserId, collection, fieldName})
    // Transfer ownership of all revisions and denormalized references for editable fields
    const editableFieldNames = editableCollectionsFields[collectionName]
    if (editableFieldNames?.length) {
      editableFieldNames.forEach((editableFieldName) => {
        transferEditableField({documentId: doc._id, targetUserId, collection, fieldName: editableFieldName})
      })
    }
  }
  documents.forEach((doc) => {
    
  })
}

const transferEditableField = ({documentId, targetUserId, collection, fieldName = "contents"}) => {
  // Update the denormalized revision on the document
  editMutation({
    collection,
    documentId,
    set: {[`${fieldName}.userId`]: targetUserId},
    unset: {},
    validate: false
  })
  // Update the revisions themselves
  Revisions.update({ documentId, fieldName }, {$set: {userId: targetUserId}}, { multi: true })
}

const mergeReadStatusForPost = ({sourceUserId, targetUserId, postId}) => {
  const sourceUserStatus = ReadStatuses.findOne({userId: sourceUserId, postId})
  const targetUserStatus = ReadStatuses.findOne({userId: targetUserId, postId})
  const readStatus = !!(sourceUserStatus?.isRead || targetUserStatus?.isRead)
  const lastUpdated = new Date(sourceUserStatus?.lastUpdated) > new Date(targetUserStatus?.lastUpdated) ? sourceUserStatus?.lastUpdated : targetUserStatus?.lastUpdated
  if (targetUserStatus) {
    ReadStatuses.update({_id: targetUserStatus._id}, {$set: {isRead: readStatus, lastUpdated}})
  } else if (sourceUserStatus) {
    // eslint-disable-next-line no-unused-vars
    const {_id, ...sourceUserStatusWithoutId} = sourceUserStatus
    ReadStatuses.insert({...sourceUserStatusWithoutId, userId: targetUserId})
  }
}

Vulcan.mergeAccounts = async (sourceUserId, targetUserId) => {
  const sourceUser = Users.findOne({_id: sourceUserId})
  const targetUser = Users.findOne({_id: targetUserId})

  // Transfer posts
  await transferCollection({sourceUserId, targetUserId, collectionName: "Posts"})

  // Transfer comments
  await transferCollection({sourceUserId, targetUserId, collectionName: "Comments"})

  // Transfer conversations
  await Conversations.update({participantIds: sourceUserId}, {$set: {"participantIds.$": targetUserId}}, { multi: true })

  // Transfer private messages
  await transferCollection({sourceUserId, targetUserId, collectionName: "Messages"})

  // Transfer notifications
  await transferCollection({sourceUserId, targetUserId, collectionName: "Notifications"})

  // Transfer readStatuses
  const readStatuses = await ReadStatuses.find({userId: sourceUserId}).fetch()
  const readPostIds = readStatuses.map((status) => status.postId)
  readPostIds.forEach((postId) => {
    mergeReadStatusForPost({sourceUserId, targetUserId, postId})
  })

  // Transfer sequences
  await transferCollection({sourceUserId, targetUserId, collectionName: "Sequences"})
  await transferCollection({sourceUserId, targetUserId, collectionName: "Collections"})
  
  // Transfer karma
  console.log("Transferring karma")
  await editMutation({
    collection: Users,
    documentId: targetUserId,
    set: {karma: sourceUser.karma + targetUser.karma, afKarma: sourceUser.afKarma + targetUser.afKarma},
    validate: false
  })
  
  // Transfer votes that target content from source user (authorId)
  console.log("Transferring votes that target source user")
  await Votes.update({authorId: sourceUserId}, {$set: {authorId: targetUserId}}, {multi: true})

  // Transfer votes cast by source user
  console.log("Transferring votes cast by source user")
  await Votes.update({userId: sourceUserId}, {$set: {userId: targetUserId}}, {multi: true})
  
  // Change slug of source account by appending "old" and reset oldSlugs array
  console.log("Change slugs of source account")
  await editMutation({
    collection: Users,
    documentId: sourceUserId,
    set: {slug: Utils.getUnusedSlug(Users, `${sourceUser.slug}-old`, true), oldSlugs: []},
    validate: false
  })

  // Add slug to oldSlugs array of target account
  const newOldSlugs = [
    ...(targetUser.oldSlugs || []), 
    ...(sourceUser.oldSlugs || []), 
    sourceUser.slug
  ]
  console.log("Changing slugs of target account", sourceUser.slug, newOldSlugs)
  
  await editMutation({
    collection: Users,
    documentId: targetUserId,
    set: {oldSlugs: newOldSlugs}, 
    validate: false
  })
  
  // Mark old acccount as deleted
  console.log("Marking old account as deleted")
  await editMutation({
    collection: Users,
    documentId: sourceUserId,
    set: {deleted: true},
    validate: false
  })
}

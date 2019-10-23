import { TagRels } from './collection.js';
import { ensureIndex } from '../../collectionUtils';

TagRels.addView('postsWithTag', terms => {
  return {
    selector: {
      tagName: terms.postId, //FIXME: Not denormalized
    },
  }
});

TagRels.addView('tagsOnPost', terms => {
  return {
    selector: {
      postId: terms.postId,
    },
  }
});

ensureIndex(TagRels, {postId:1});
ensureIndex(TagRels, {tagId:1});

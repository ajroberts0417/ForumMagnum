import React, { useState }  from 'react';
import { Components, registerComponent, useMulti, getFragment, useCreate } from 'meteor/vulcan:core';
import { useMutation } from 'react-apollo';
import gql from 'graphql-tag';
import { withStyles } from '@material-ui/core/styles';
import { TagRels } from '../../lib/collections/tagRels/collection.js';
import Paper from '@material-ui/core/Paper';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

const styles = {
  root: {
    marginTop: 16,
    marginBottom: 16,
  },
  tagsLabel: {
    verticalAlign: "baseline",
  },
  addTagButton: {
    border: "1px solid #888",
    borderRadius: 15,
    display: "inline-block",
    width: 30,
    height: 30,
    textAlign: "center",
    paddingTop: 5,
    verticalAlign: "middle",
    
    "&:hover": {
      opacity: 1.0,
      borderColor: "black",
    },
  },
};

const FooterTagList = ({post, classes}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  
  const { results, loading } = useMulti({
    terms: {
      view: "tagsOnPost",
      postId: post._id,
    },
    collection: TagRels,
    queryName: "postFooterTagsQuery",
    fragmentName: "TagRelMinimumFragment",
    limit: 100,
    ssr: true,
  });
  
  const [mutate] = useMutation(gql`
    mutation addOrUpvoteTag($tagId: String, $postId: String) {
      addOrUpvoteTag(tagId: $tagId, postId: $postId) {
        tag {
          ...TagFragment
        }
        tagRel {
          ...TagRelFragment
        }
      }
    }
    ${getFragment("TagFragment")}
    ${getFragment("TagRelFragment")}
  `);
  /*const {create: createTagRel} = useCreate({
    collection: TagRels,
    fragmentName: "TagRelFragment",
  });*/
  
  if (loading || !results)
    return <Components.Loading/>;
  
  return <div className={classes.root}>
    <span className={classes.tagsLabel}>Tags: </span>
    
    {results.map((result, i) => <span key={result._id}>
      {i>0 && ", "}
      <Components.FooterTag tagRel={result} tag={result.tag}/>
    </span>)}
    <a
      onClick={(ev) => {setAnchorEl(ev.currentTarget); setIsOpen(true)}}
      className={classes.addTagButton}
    >
      {"+"}
      
      <Components.LWPopper
        open={isOpen}
        anchorEl={anchorEl}
        placement="bottom-start"
      >
        <ClickAwayListener
          onClickAway={() => setIsOpen(false)}
        >
          <Paper>
            <Components.AddTag
              post={post}
              onTagSelected={tag => {
                console.log(`Selected tag: ${tag.name}`);
                setAnchorEl(null);
                setIsOpen(false);
                console.log(`tagId: ${tag._id}, postId: ${post._id}`);
                mutate({
                  variables: {
                    tagId: tag._id,
                    postId: post._id,
                  },
                  //update: cacheUpdateGenerator() //TODO
                });
                /*createTagRel({
                  tagId: tag._id,
                  postId: post._id,
                });*/
              }}
            />
          </Paper>
        </ClickAwayListener>
      </Components.LWPopper>
    </a>
  </div>
};

registerComponent("FooterTagList", FooterTagList,
  withStyles(styles, { name: "FooterTagList" })
);

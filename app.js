(function (window) {

  'use strict';

  var maquette = window.maquette,
      h = maquette.h,
      projector = maquette.createProjector(),
      params = {
        name: encodeURIComponent('datboi'),
        age: encodeURIComponent('indeterminate')
      },
      parameters = "name="+params.name+"&age="+params.age,
      today = Date.now();
      

  /******************
  app state object
  ******************/
  var state = {
        data: [],
        headLength: 0,
        tailLength: 0,
        searchResults: new Map(),
        filter: 'recent',
        randomPhotos: new Map(),
        random: [],
        $root: document.getElementById("app"),
        count: 2,
        perPage: 50,
        maxPages: -1,
        maxPhotos: 10,
        term: '',
      };


  function getPhotoPage(page, callback, filter) {
    window.removeEventListener('scroll', onScroll, false);
    var pageNumber = parseInt(page),
        postRequest = new ajaxRequest(),
        endpointUrl = "https://api.flickr.com/services/rest/?method=flickr.people.getPublicPhotos&api_key=a5e95177da353f58113fd60296e1d250&user_id=24662369@N07&format=json&nojsoncallback=1&per_page=50&extras=description,date_upload,owner_name&page="+pageNumber;

    postRequest.onreadystatechange = function() {
     if (postRequest.readyState == 4) {
      if (callback && postRequest.status == 200 || window.location.href.indexOf("http") == -1) {
        var data = JSON.parse(postRequest.responseText);
        callback(data, parseInt(page), filter);
        if (state.tailLength == 0)
          getPhotoPage(parseInt(data.photos.pages), callback);
      }
      else{
       alert("An error has occured making the request");
      }
     }
    }

    postRequest.open(
      "POST",
      endpointUrl,
      true
    );
    postRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    postRequest.send(parameters);
  }

  function searchPhotos(term, callback) {
    var postRequest = new ajaxRequest(),
        endpointUrl = "https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=a5e95177da353f58113fd60296e1d250&user_id=24662369@N07&text="+
                      encodeURIComponent(term)+
                      "&format=json&nojsoncallback=1&extras=description,date_upload,owner_name&per_page=500";

    postRequest.onreadystatechange = function() {
     if (postRequest.readyState == 4) {
      if (callback && postRequest.status == 200 || window.location.href.indexOf("http") == -1) {
       callback(term, postRequest.responseText);
      }
      else{
       alert("An error has occured making the request");
      }
     }
    }

    postRequest.open(
      "POST",
      endpointUrl,
      true
    );
    postRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    postRequest.send(parameters);
  }

  function getInfo(photoId, page, callback) {
    var postRequest = new ajaxRequest(),
        endpointUrl = "https://api.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key=a5e95177da353f58113fd60296e1d250&photo_id="+
                      photoId+
                      "&format=json&nojsoncallback=1";

    postRequest.onreadystatechange = function() {
     if (postRequest.readyState == 4) {
      if (callback && postRequest.status == 200 || window.location.href.indexOf("http") == -1) {
       callback(photoId, page, postRequest.responseText);
      }
      else{
       alert("An error has occured making the request");
      }
     }
    }

    postRequest.open(
      "POST",
      endpointUrl,
      true
    );
    postRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    postRequest.send(parameters);
  }

  function setInfo(photoId, page, data) {
    if (state.filter == 'search') {
      var responseObj = JSON.parse(data),
          responseInfo = responseObj.photo,
          currentPhotos = state.searchResults.get(state.term);
      if (currentPhotos) {
        var photoObj = currentPhotos.find(function(photo) {
              return photo.id === photoId
            });
        if (photoObj) {
          photoObj.views = responseInfo.views;
          photoObj.uploadDate = parseInt(photoObj.dateupload);
          photoObj.owner = responseInfo.owner;

          setState({
            searchResults: state.searchResults.set(state.term, currentPhotos)
          });
        }
      }
    } else {
      var responseObj = JSON.parse(data),
          responseInfo = responseObj.photo,
          newData = JSON.parse(JSON.stringify(state.data)),
          currentPhotos = newData[page],
          photoObj = {};

      if (currentPhotos)
          photoObj = currentPhotos.find(function(photo) {
            return photo.id === photoId
          });

      photoObj.views = responseInfo.views;
      photoObj.uploadDate = parseInt(photoObj.dateupload);
      photoObj.owner = responseInfo.owner;

      setState({
        data: newData
      });
    }
  }

  function ingest(data, page, filter) {

    data.photos.photo.map(function(photo) {
      photo.uploadDate = parseInt(photo.dateupload);
      photo.age = msToAge(today - photo.uploadDate * 1000);
    });

    if (state.headLength == 0 && page == 1) { // initial ingest of first page

      var newData = new Array(parseInt(data.photos.pages));
      newData[page] = data.photos.photo;
      setState({
        data: newData,
        headLength: state.headLength + data.photos.photo.length,
        perPage: parseInt(data.photos.perpage),
        maxPages: parseInt(data.photos.pages),
        maxPhotos: parseInt(data.photos.total)
      });

    } else if (state.tailLength == 0 && page == state.maxPages) { // ingest of last page

      var newData = _.clone(state.data);
      newData[page] = data.photos.photo;
      setState({
        data: newData,
        tailLength: state.tailLength + data.photos.photo.length
      });

    } else { // ingest of every subsequent page

      switch (filter) {

        case 'recent':
          var newData = _.clone(state.data);
          newData[page] = data.photos.photo;
          var headLength = 0,
              prev = 0;
          for (var i=1, len=newData.length; i<len; i++) {
            if (newData[i] && i-1 == prev) {
              headLength += newData[i].length;
              prev = i;
            } else {
              break;
            }
          }
          setState({
            data: newData,
            headLength: headLength
          });
        break;

        case 'oldest':
          var newData = _.clone(state.data);
          newData[page] = data.photos.photo;
          var tailLength = 0,
              prev = state.maxPages+1;
          for (var i=newData.length-1; i>0; i--) {
            if (newData[i] && i+1 == prev) {
              tailLength += newData[i].length;
              prev = i;
            } else {
              break;
            }
          }
          setState({
            data: newData,
            tailLength: tailLength
          });
        break;

        case 'random':
          var newData = _.clone(state.data);
          newData[page] = data.photos.photo;
          var nextHeadPage = state.headLength / state.perPage + 1,
              nextTailPage = state.maxPages - ((state.tailLength - state.maxPhotos%state.perPage) / state.perPage + 1);

          if (page == nextHeadPage || page == nextTailPage) {

            var headLength = 0,
                tailLength = 0,
                prev = 0;
            for (var i=1, len=newData.length; i<len; i++) {
              if (newData[i] && i-1 == prev) {
                headLength += newData[i].length;
                prev = i;
              } else {
                break;
              }
            }
            prev = state.maxPages+1;
            for (var i=newData.length-1; i>0; i--) {
              if (newData[i] && i+1 == prev) {
                tailLength += newData[i].length;
                prev = i;
              } else {
                break;
              }
            }
            setState({
              data: newData,
              headLength: headLength,
              tailLength: tailLength
            });

          } else {

            setState({
              data: newData
            });

          }
        break;

        default:
            console.error('invalid filter state')
        break;
      }

    }

    // get photo info
    /*data.photos.photo.map(function(photo) {
      if (!photo.views) {
        getInfo(photo.id, page, setInfo)
      }
    });*/ // rerendering after every single query just for views data not worth it

    window.removeEventListener('scroll', onScroll, false);
    window.addEventListener('scroll', onScroll, false);

  }

  function ingestSearchResults(term, results) {
    var data = JSON.parse(results),
        searchResults = _.clone(state.searchResults);
    searchResults.set(term, data.photos.photo);
    data.photos.photo.map(function(photo) {
      photo.uploadDate = parseInt(photo.dateupload);
      photo.age = msToAge(today - photo.uploadDate * 1000);
    });
    setState({
      searchResults: searchResults
    });
    data.photos.photo.map(function(photo) {
      if (!photo.views) {
        getInfo(photo.id, -1, setInfo)
      }
    });
  }

  function setFilter(e) {
    var filter = e.target.getAttribute('name') ? e.target.getAttribute('name').toLowerCase() : e.target.textContent.toLowerCase();

    // set app logo click to go to recent filter
    filter = filter.indexOf('nasa') > -1 ? 'recent' : filter;

    window.scroll(0,0);

    if (filter != state.filter) {
      if (filter == 'random') {

        var randomPhotos = new Map(),
            random = [];

        for (var i=0; i<2; i++) {
          var randomPage = (Math.random() * state.maxPages) | 0 + 1,
              randomIndex = (randomPage == state.maxPages ? (Math.random() * state.maxPhotos%state.perPage) : (Math.random() * state.perPage)) | 0;
          while (state.randomPhotos.has(randomPage) && state.randomPhotos.get(randomPage).includes(randomIndex)) {
            randomPage = Math.floor((Math.random() * state.maxPages)) + 1;
            randomIndex = (randomPage == state.maxPages ? Math.floor(Math.random() * state.maxPhotos%state.perPage) : Math.floor(Math.random() * state.perPage));
          }
          if (state.randomPhotos.has(randomPage)) {
            randomPhotos.set(randomPage, state.randomPhotos.get(randomPage).concat(randomIndex));
          } else {
            randomPhotos.set(randomPage, [].concat(randomIndex));
          }

          random.push({page: randomPage, index: randomIndex});

          if (state.data[randomPage] == undefined) {
            getPhotoPage(randomPage, ingest, filter);
          }
        }

        setState({
          filter: filter,
          count: 2,
          randomPhotos: randomPhotos,
          random: random
        });

      } else {

        setState({
          filter: filter,
          count: 2
        });

      }
    }
  }

  function handleTermChange(e) {
    setState({
      term: e.target.value
    });
    if (_.compact(state.data).length < state.maxPages+1 && e.target.value.length > 0) {
      if (!state.searchResults.has(e.target.value))
        searchPhotos(e.target.value, ingestSearchResults);
    }
  }

  function setState(nextState) {
    Object.getOwnPropertyNames(nextState).forEach(function(prop) {
      state[prop] = nextState[prop]
    });
    // trigger vdom diff and rerender
    projector.scheduleRender();
  }

  function render() {
    var components = [];

    // APP HEADER COMPONENT
    components.push(
      renderAppHeader()
    );

    // ASSEMBLE PHOTOS
    var photos = [];
    switch (state.filter) {

      case 'recent':
        for (var i=1; i<=state.headLength/state.perPage; i++) {
          if (state.data[i]) {
            for (var j=0, len=state.data[i].length; j<len; j++) {
                photos.push(state.data[i][j]);
              if (photos.length == state.count)
                break;
            }
          }
        }
      break;

      case 'oldest':
        for (var i=1; i<=(state.tailLength-state.maxPhotos%state.perPage)/state.perPage + 1; i++) {
          if (state.data[state.data.length-i]) {
            var sortedPhotos = _.clone(state.data[state.data.length-i]);
                sortedPhotos.sort(function(a,b) {return a.uploadDate-b.uploadDate});
            for (var j=0, len=sortedPhotos.length; j<len; j++) {
              photos.push(sortedPhotos[j]);
              if (i*j >= state.count)
                break;
            }
          }
        }
        photos.sort(function(a,b) {return a.uploadDate-b.uploadDate});
      break;

      case 'random':
        state.random.forEach(function(r){
          var key = r.page,
              index = r.index;
          if (state.data[key] && state.data[key][index]) {
            photos.push(state.data[key][index]);
          }
        });
      break;

      case 'search':
        components.push(
          h('input.search', {
            type: 'text',
            autofocus: 1,
            value: state.term,
            placeholder: 'type to begin searching...',
            oninput: handleTermChange
          })
        );
        if (state.term.length > 0) {
          if (_.compact(state.data).length < state.maxPages) {
            photos = state.searchResults.get(state.term);
          } else {
            photos = searchLocalPhotos(state.term);
          }
        }
      break;

      default: // render at mystery filter state
        console.error('myster filter state at render')
        components.push(
          h('img.loading',
            {src: './loading.gif'}
          )
        );
      break;
    }


    // RENDER PHOTO CARD COMPONENTS
    if (photos && photos.length > 0) {
      for (var i=0, len=state.count; i<len; i++) {
        if (i<photos.length)
          components.push(
            renderPhoto(photos[i], i)
          );
      }
    } else { // if loading search results
      if (state.filter == 'search' && state.term.length > 0 && !state.searchResults.has(state.term)) {
        components.push(
          h('img.loading',
            {src: './loading.gif'}
          )
        );
      }
    }


    return h('div', components);

  }

  function renderAppHeader() {
    return h('header.appBar', [
            h('h1.appTitle',
              {
                onclick: setFilter
              },
              [
                h('span', 'NASA'),
                'gram'
              ]
            ),
            h('ul.filters', [
              h('li.filter'+(state.filter == 'recent' ? '.selected' : ''), {
                key: 'recent',
                name: 'recent',
                onclick: setFilter
              }, 'RECENT'),
              h('li.filter'+(state.filter == 'oldest' ? '.selected' : ''), {
                key: 'oldest',
                name: 'oldest',
                onclick: setFilter
              }, 'OLDEST'),
              h('li.filter'+(state.filter == 'random' ? '.selected' : ''), {
                key: 'random',
                name: 'random',
                onclick: setFilter
              }, 'RANDOM'),
              h('li.filter'+(state.filter == 'search' ? '.selected' : ''), {
                key: 'search',
                name: 'search',
                onclick: setFilter,
              }, ['SEARCH ', h('i.material-icons', 'search')])
            ])
          ])
  }

  function renderPhoto(photo, ct) {

    var urlDefault = 'https://farm' + photo.farm + '.staticflickr.com/' + photo.server + '/' + photo.id + '_' + photo.secret + '.jpg',
        tmp = document.createElement("div");
    tmp.innerHTML = photo.description ? photo.description._content ? photo.description._content : photo.description : '';

    var desc = tmp.textContent || tmp.innerText || "";

    return h('article.card.'+ct,
            {
              key: photo.id
            },
            [
              h('div.cardHeader',
                [
                  h('img.icon', {src: './nasa-icon.png'}),
                  h('h2.username', photo.ownername ? photo.ownername : 'NASA Goddard Photo and Video'),
                  h('h2.location', photo.owner ? photo.owner.location ? photo.owner.location : 'Greenbelt, MD, USA' : 'Greenbelt, MD, USA'),
                  h('h6.age', photo.age)
                ]
              ),
              h('img.image', {
                key: photo.id,
                src: urlDefault
              }),
              h('div.info', {
                  key: photo.id,
                },
                [
                  h('strong.views', photo.views ? photo.views+' views' : ''),
                  h('h2.title', photo.title ? photo.title : ''),
                  h('br'),
                  h('p.desc', desc)
                ]
              )
            ]
          )
  }

  function onScroll(e) {

      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50 &&
          state.count < state.maxPhotos) {

        if (state.filter == 'random') {
          var randomPhotos = new Map(state.randomPhotos),
              random = _.clone(state.random),
              randomPhotoCount = state.count == state.maxPhotos-1 ? 1 : 2;

          for (var i=0; i<randomPhotoCount; i++) {
            var randomPage = Math.floor((Math.random() * state.maxPages)) + 1,
                randomIndex = (randomPage == state.maxPages ? Math.floor(Math.random() * state.maxPhotos%state.perPage) : Math.floor(Math.random() * state.perPage));
            while (state.randomPhotos.has(randomPage) && state.randomPhotos.get(randomPage).includes(randomIndex)) {
              randomPage = Math.floor((Math.random() * state.maxPages)) + 1;
              randomIndex = (randomPage == state.maxPages ? Math.floor(Math.random() * state.maxPhotos%state.perPage) : Math.floor(Math.random() * state.perPage));
            }
            if (state.randomPhotos.has(randomPage)) {
              randomPhotos.set(randomPage, state.randomPhotos.get(randomPage).concat(randomIndex));
            } else {
              randomPhotos.set(randomPage, [].concat(randomIndex));
            }

            random.push({page: randomPage, index: randomIndex});

            if (state.data[randomPage] == undefined) {
              getPhotoPage(randomPage, ingest, state.filter); 
            }
          }

          setState({
            randomPhotos: randomPhotos,
            random: random,
            count: state.count == state.maxPhotos-1 ? state.count+1 : state.count+2
          });

        } else {

          setState({
            count: state.count == state.maxPhotos-1 ? state.count+1 : state.count+2
          });

        }
      }

      switch (state.filter) {
        case 'recent':
          if (state.headLength - state.count < 10 && _.compact(state.data).length < state.maxPages) {
            getPhotoPage(state.headLength/state.perPage + 1, ingest, state.filter);
          }
        break;
        case 'oldest':
          if (state.tailLength - state.count < 10 && _.compact(state.data).length < state.maxPages) {
            getPhotoPage(state.maxPages - (state.tailLength - state.maxPhotos%state.perPage)/state.perPage - 1, ingest, state.filter);
          }
        break;
      }
  }

  function searchLocalPhotos(term) {
    var data = _.compact(state.data),
        photos = [];

    data.forEach(function(page) {
      page.map(function(photo) {
        photos.push(photo);
      });
    });

    return photos.reduce(function(matches, photo, index) {
      if (term.length > 0) {
        if ( photo.ownername && photo.ownername.toLowerCase().indexOf(term) != -1 ||
             photo.owner && photo.owner.location && photo.owner.location.toLowerCase().indexOf(term) != -1 ||
             photo.title && photo.title.toLowerCase().indexOf(term) != -1 ||
             photo.views && photo.views.toString().toLowerCase().indexOf(term) != -1 ||
             photo.description && photo.description._content.toLowerCase().indexOf(term) != -1 ||
             photo.age && photo.age.indexOf(term) != -1 ) {
          matches.push(photo);
        }
      }
      return matches
    }, []).sort(function(a,b) {
      return b.uploadDate - a.uploadDate
    });
  }

  function start() {
    getPhotoPage(1, ingest, state.filter);
  }




  function msToAge (ms) {
    function strEnding (val) {return val > 1 ? 's' : '';}
    var temp = Math.floor(ms / 1000);

    var years = Math.floor(temp / 31536000);
    if (years)
      return years + ' year' + strEnding(years);

    var months = Math.floor((temp %= 31536000) / 2661120);
    if (months)
      return months + ' month' + strEnding(months);

    var weeks =  Math.floor((temp %= 31536000) / 604800);
    if (weeks)
      return weeks + ' week' + strEnding(weeks);
    
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days)
      return days + ' day' + strEnding(days);
    
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours)
      return hours + ' hour' + strEnding(hours);
    
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes)
      return minutes + ' minute' + strEnding(minutes);
    
    var seconds = temp % 60;
    if (seconds)
      return seconds + ' second' + strEnding(seconds);

    return 'less than a second ago';
  }

  function ajaxRequest(){
    var activexmodes = ["Msxml2.XMLHTTP", "Microsoft.XMLHTTP"]
    if (window.ActiveXObject) {
      for (var i=0; i<activexmodes.length; i++) {
        try {
            return new ActiveXObject(activexmodes[i])
        } catch(e) { console.error(e) }
      }
    } else {
      if (window.XMLHttpRequest)
        return new XMLHttpRequest()
      else
        return false
    }
  }



  document.addEventListener('DOMContentLoaded', function() {

    start();
    projector.merge(state.$root, render);


  });




})(window);

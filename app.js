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
				photos: [],
				filter: 'recent',
				$root: document.getElementById("app"),
				count: 2,
				page: 0,
				perPage: 50,
				maxPages: -1,
				maxPhotos: 10,
				term: ''
			};


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

	function getPhotos(callback) {
		var postRequest = new ajaxRequest(),
				endpointUrl = "https://api.flickr.com/services/rest/?method=flickr.people.getPublicPhotos&api_key=a5e95177da353f58113fd60296e1d250&user_id=24662369@N07&format=json&nojsoncallback=1&per_page=50&extras=description,date_upload,owner_name";

		postRequest.onreadystatechange = function() {
		 if (postRequest.readyState == 4) {
		  if (callback && postRequest.status == 200 || window.location.href.indexOf("http") == -1) {
		   callback(postRequest.responseText);
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

	function getNextPhotos(page, callback) {
		window.removeEventListener('scroll', onScroll, false);
		var postRequest = new ajaxRequest(),
				endpointUrl = "https://api.flickr.com/services/rest/?method=flickr.people.getPublicPhotos&api_key=a5e95177da353f58113fd60296e1d250&user_id=24662369@N07&format=json&nojsoncallback=1&per_page=50&page="+page+1;

		postRequest.onreadystatechange = function() {
		 if (postRequest.readyState == 4) {
		  if (callback && postRequest.status == 200 || window.location.href.indexOf("http") == -1) {
		   callback(postRequest.responseText);
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

	function getInfo(photoId, callback) {
		var postRequest = new ajaxRequest(),
				endpointUrl = "https://api.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key=a5e95177da353f58113fd60296e1d250&photo_id="+
											photoId+
											"&format=json&nojsoncallback=1";

		postRequest.onreadystatechange = function() {
		 if (postRequest.readyState == 4) {
		  if (callback && postRequest.status == 200 || window.location.href.indexOf("http") == -1) {
		   callback(photoId, postRequest.responseText);
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

	function setInfo(photoId, data) {
		var responseObj = JSON.parse(data),
				responseInfo = responseObj.photo,
				currentPhotos = JSON.parse(JSON.stringify(state.photos)),
				photoObj = currentPhotos.find(function(photo) {
					return photo.id === photoId
				});

		Object.assign(photoObj, responseInfo);

		setState({
			photos: currentPhotos
		});
	}

	function ingest(data) {
		var dataObject = JSON.parse(data),
				photoObjects = dataObject.photos.photo,
				currentPhotos = state.photos,
				newPhotos = currentPhotos.concat(photoObjects);

		newPhotos.map(function(photo) {
			photo.ageString = msToAge(parseInt(photo.dateupload) * 1000);
			photo.uploadDate = parseInt(photo.dateupload);
		});
		if (state.maxPages == -1) {
			setState({
				photos: newPhotos,
				perPage: parseInt(dataObject.photos.perpage),
				maxPages: parseInt(dataObject.photos.pages),
				maxPhotos: parseInt(dataObject.photos.total),
				page: 1
			});
		} else {
			setState({
				photos: newPhotos,
				page: (state.page * state.perPage - state.count) < 10 ? state.page+1 : state.page
			});
		}

		// get photo info
		photoObjects.map(function(photo) {
			if (!photo.views) {
				getInfo(photo.id, setInfo)
			}
		});

		window.addEventListener('scroll', onScroll, false);
	}


	function setState(nextState) {
		Object.getOwnPropertyNames(nextState).forEach(function(prop) {
			state[prop] = nextState[prop]
		});
		// trigger vdom diff and rerender
		projector.scheduleRender();
	}


	function setFilter(e) {
		var filter = e.target.getAttribute('name') ? e.target.getAttribute('name').toLowerCase() : e.target.textContent.toLowerCase()
		filter = filter.indexOf('nasa') > -1 ? 'recent' : filter;
		window.scroll(0,0);
		setState({
			filter: filter,
			count: 2
		});
	}

	function handleTermChange(e) {
		setState({
			term: e.target.value
		});
	}

	function render() {
		var components = [];

		// RENDER APP HEADER
		components.push(
			renderAppHeader()
		);

		// SORT PHOTOS
		var sortedData = sortPhotos(JSON.parse(JSON.stringify(state.photos)), state.filter);

		// RENDER SEARCH INPUT
		if (state.filter == 'search')
			components.push(
					h('input.search', {
						type: 'text',
						autofocus: 1,
						value: state.term,
						placeholder: 'type to begin searching...',
						oninput: handleTermChange
					})
				);

		// RENDER PHOTO CARDS
		for (var i=0, len=state.count; i<len; i++) {
			if (i<sortedData.length)
				components.push(
					renderPhoto(sortedData[i], i)
				);
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

	function sortPhotos(photos, filter) {
		var sortedData;
		switch (filter) {
			case 'recent':
				sortedData = photos.sort(function(a,b) {
					return b.dateupload - a.dateupload
				})
			break;
			case 'oldest':
				sortedData = photos.sort(function(a,b) {
					return a.uploadDate - b.uploadDate
				})
			break;
			case 'random':
				sortedData = photos;
				var currentIndex = sortedData.length, temp, randomIndex;
			  while (0 !== currentIndex) {
			    randomIndex = Math.floor(Math.random() * currentIndex);
			    currentIndex -= 1;
			    temp = sortedData[currentIndex];
			    sortedData[currentIndex] = sortedData[randomIndex];
			    sortedData[randomIndex] = temp;
			  }
			break;
			case 'search':
				sortedData = photos.reduce(function(matches, photo, index) {
											if (state.term.length > 0 && photo.owner) {
												var term = state.term.toLowerCase();
												if ( photo.owner.username.toLowerCase().indexOf(term) != -1 ||
														 photo.owner.location.toLowerCase().indexOf(term) != -1 ||
														 photo.title._content.toLowerCase().indexOf(term) != -1 ||
														 photo.views.toString().toLowerCase().indexOf(term) != -1 ||
														 photo.description._content.toLowerCase().indexOf(term) != -1 ||
														 photo.ageString.indexOf(term) != -1 ) {

														matches.push(photo)

												}
											}

											return matches.sort(function(a,b) {
															 return a.age - b.age
														 })
											}, []);
			break;
			default:
				sortedData = photos.sort(function(a,b) {
					return b.dateupload - a.dateupload
				})
			break;
		}
			
		return sortedData;
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
									h('h2.username', photo.owner ? photo.owner.username ? photo.owner.username : '' : photo.ownername ? photo.ownername : ''),
									h('h2.location', photo.owner ? photo.owner.location ? photo.owner.location : '' : ''),
									h('h6.age', msToAge(today - (photo.dateupload ? photo.dateupload : photo.dates ? photo.dates.posted : 0)* 1000))
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
							  	h('h2.title', photo.title ? photo.title._content ? photo.title._content : photo.title : ''),
							  	h('br'),
							  	h('p.desc', desc)
						  	]
						  )
						]
					)
	}


	function onScroll() {
	    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
	    		if (state.count < state.maxPhotos) {
	    			if (state.count == state.maxPhotos-1) {
	    				setState({
			        	count: state.count + 1
			        });
	    			} else {
			        setState({
			        	count: state.count + 2
			        });
			      }
		      }
	    }
	    if (state.page > 0 &&
		    	(state.page * state.perPage - state.count) < 10 &&
		    	state.page == state.photos.length/state.perPage &&
		    	state.page+1 < state.maxPages) {
	    	getNextPhotos(state.page, ingest);
	    }
	}




	function start() {
		getPhotos(ingest);
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







	document.addEventListener('DOMContentLoaded', function() {

		start();
		projector.merge(state.$root, render);


	});




})(window);

const dotenv = require('dotenv');
const express = require('express');
const firebaseAdmin = require('./commons/firebaseAdmin');
const algoliasearch = require('algoliasearch');
const Geode = require('geode');

dotenv.load();

const router = express.Router();
const algolia = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
const indexUserMetadata = algolia.initIndex(process.env.ALGOLIA_INDEX_USERMETADATA);

router.get('/photographers', function (request, response) {
  var destination = request.query['filter']['destination'];
  var date = request.query['filter']['date'];
  var search = {
    query: destination,
    hitsPerPage: process.env.ALGOLIA_HITS_PER_PAGE,
    page: request.query['filter']['page'],
    attributesToHighlight: ['locationMerge'],
    facets: ['userType'],
    facetFilters: [['userType:photographer']]
  };

  if (date !== '') {
    search.filters = 'NOT notAvailableDates:' + date;
  }

  indexUserMetadata.search(search, function searchDone(error, content) {
    if (error) {
      console.log(error);
      response.json({ data: [] });
    } else {
      response.json({
        data: content.hits,
        metaInfo: {
          nbHits: content.nbHits,
          page: content.page,
          nbPages: content.nbPages,
          hitsPerPage: content.hitsPerPage
        }
      });
    }
  });
});

router.get('/topPhotographers', function (request, response) {
  indexUserMetadata.search({
    attributesToHighlight: ['locationMerge'],
    facets: ['topPhotographer', 'userType'],
    facetFilters: [['topPhotographer:true']]
  }, function searchDone(error, content) {
    if (error) {
      console.log(error);
      response.json({ data: [] });
    } else {
      response.json({ data: content.hits });
    }
  });
});

router.get('/photographers/:uid', function (request, response) {
  const uid = request.params.uid;
  const db = firebaseAdmin.database();

  db
    .ref('photographer_service_information')
    .child(uid)
    .once('value')
    .then(function (data) {
      const photographerServiceInformationData = data.val();
      if (photographerServiceInformationData) {
        db
          .ref('user_metadata')
          .child(uid)
          .once('value')
          .then(function (userMetadataData) {
            photographerServiceInformationData.userMetadata = userMetadataData.val();
            response.json({ data: photographerServiceInformationData });
          });

      } else {
        response.json({ data: {} });
      }
    });
});

router.get('/cities', function (request, response) {
  const qry = request.query['kwd'];
  const countryCode = request.query['countryCode'];
  const continent = request.query['continent'];
  const geo = new Geode('okaprinarjaya', { countryCode: countryCode });

  geo.search({ q: qry, continentCode: continent, featureClass: 'A' }, function (error, result) {
    if (error) {
      console.log(error);
    } else {
      var results = [];
      result.geonames.forEach(function (item) {
        results.push(
          {
            value: item.toponymName,
            label: item.toponymName,
            adm1: item.adminName1
          }
        );
      });
      response.json({ data: results });
    }
  });
});

router.get('/locations', function (request, response) {
  indexUserMetadata.search({
    query: request.query.keyword,
    distinct: true,
    attributesToHighlight: ['countryName'],
    facets: ['userType'],
    facetFilters: [['userType:photographer']],
    attributesToRetrieve: ['countryName', 'locationAdmLevel1', 'locationAdmLevel2']
  }, function searchDone(error, content) {
    if (error) {
      console.error(error);
      response.json({ data: [] });
    } else {
      const results = content.hits.map(function (item) {
        return { label: item.locationAdmLevel2 + ', ' + item.locationAdmLevel1 + ', ' + item.countryName };
      });
      response.json({ data: results });
    }
  });
});

module.exports = router;
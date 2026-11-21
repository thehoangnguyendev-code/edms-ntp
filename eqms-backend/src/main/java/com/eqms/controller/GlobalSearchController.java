package com.eqms.controller;

import com.eqms.dto.search.GlobalSearchResponse;
import com.eqms.service.GlobalSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/search")
public class GlobalSearchController {

    private final GlobalSearchService service;

    public GlobalSearchController(GlobalSearchService service) {
        this.service = service;
    }

    /** The few best matches of every kind of record the signed-in person can reach (pages, documents, revisions, copies, users, trainings). */
    @GetMapping("/global")
    public ResponseEntity<GlobalSearchResponse> search(@RequestParam("q") String query) {
        return ResponseEntity.ok(service.search(query));
    }
}

package dataselect

import (
	"sort"
	"strings"
	"time"
)

const (
	// DefaultLimit 是调用方未传 limit 时使用的每页条数。
	DefaultLimit = 10
	// MaxLimit 是单页允许返回的最大条数，防止一次拉取过多对象。
	MaxLimit = 500
)

type DataSelector struct {
	GenericDataList   []DataCell
	DataSelectorQuery *DataSelectorQuery
}

type DataCell interface {
	GetCreation() time.Time
	GetName() string
}

type DataSelectorQuery struct {
	FilterQuery *FilterQuery
	Pagination  *PaginateQuery
}

type FilterQuery struct {
	Name string
}

type PaginateQuery struct {
	Limit int
	Page  int
}

func (d *DataSelector) Len() int {
	return len(d.GenericDataList)
}

func (d *DataSelector) Swap(i, j int) {
	d.GenericDataList[i], d.GenericDataList[j] = d.GenericDataList[j], d.GenericDataList[i]
}

func (d *DataSelector) Less(i, j int) bool {
	return d.GenericDataList[i].GetCreation().Before(d.GenericDataList[j].GetCreation())
}

func (d *DataSelector) Sort() *DataSelector {
	sort.Sort(d)
	return d
}

// Filter 按名称做大小写不敏感的子串匹配。
func (d *DataSelector) Filter() *DataSelector {
	query := d.DataSelectorQuery
	if query == nil || query.FilterQuery == nil || query.FilterQuery.Name == "" {
		return d
	}

	name := strings.ToLower(query.FilterQuery.Name)
	tmp := make([]DataCell, 0, len(d.GenericDataList))
	for _, v := range d.GenericDataList {
		if strings.Contains(strings.ToLower(v.GetName()), name) {
			tmp = append(tmp, v)
		}
	}
	d.GenericDataList = tmp
	return d
}

// Paginate 按 page/limit 切片。limit 或 page 非法时会回落到默认值，
// 而不是像旧实现那样返回空列表。
func (d *DataSelector) Paginate() *DataSelector {
	query := d.DataSelectorQuery
	if query == nil || query.Pagination == nil {
		return d
	}

	limit, page := query.Pagination.Limit, query.Pagination.Page
	if limit <= 0 {
		limit = DefaultLimit
	}
	if limit > MaxLimit {
		limit = MaxLimit
	}
	if page <= 0 {
		page = 1
	}

	total := len(d.GenericDataList)
	start := limit * (page - 1)
	if start >= total {
		d.GenericDataList = []DataCell{}
		return d
	}

	end := start + limit
	if end > total {
		end = total
	}
	d.GenericDataList = d.GenericDataList[start:end]
	return d
}
